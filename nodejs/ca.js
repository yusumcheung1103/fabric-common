/**
 * [[{"code":0,
 * "message":"The CN 'david.repeat(20)@Merchant'
 * exceeds the maximum character limit of 64"}]]
 */
const path = require('path');
const logger = require('./logger').new('ca-core');
const CAClient = require('fabric-ca-client/lib/FabricCAServices');
const {fsExtra} = require('./path');
const FABRIC_CA_HOME = '/etc/hyperledger/fabric-ca-server';
const identityServiceUtil = require('./identityService');
const ClientUtil = require('./client');
exports.container = {
	FABRIC_CA_HOME,
	CONFIG: path.resolve(FABRIC_CA_HOME, 'fabric-ca-server-config.yaml'),
	caKey: path.resolve(FABRIC_CA_HOME, 'ca-key.pem'),
	caCert: path.resolve(FABRIC_CA_HOME, 'ca-cert.pem'),
	tlsCert: path.resolve(FABRIC_CA_HOME, 'tls-cert.pem'),
};

exports.toAdminCerts = ({certificate}, cryptoPath, type) => {
	const {admincerts} = cryptoPath.MSPFile(type);
	fsExtra.outputFileSync(admincerts, certificate);
};

exports.intermediateCA = {
	register: (caService, {enrollmentID, affiliation}, adminUser) => {

		return caService.register({
			enrollmentID,
			affiliation: affiliation.toLowerCase(),
			role: 'client',
			maxEnrollments: -1,
			attrs: [{name: 'hf.IntermediateCA', value: 'true'}]
		}, adminUser);
	}

};

const registerIfNotExist = async (caService, {enrollmentID, enrollmentSecret, affiliation, role}, admin) => {
	try {
		const identityService = identityServiceUtil.new(caService);

		const secret = await identityServiceUtil.create(identityService, admin, {
			enrollmentID, enrollmentSecret, affiliation, role,
		});
		if (!enrollmentSecret) {
			logger.info('new enrollmentSecret generated by ca service');
			return {enrollmentID, enrollmentSecret: secret, status: 'generated'};
		}
		else return {enrollmentID, enrollmentSecret, status: 'assigned'};
	} catch (err) {
		logger.warn(err.toString());
		if (err.toString().includes('is already registered')) {
			return {enrollmentID, enrollmentSecret, status: 'existed'};
		} else {
			throw err;
		}
	}
};
exports.pkcs11_key = {
	generate: (cryptoSuite) => cryptoSuite.generateKey({ephemeral: !cryptoSuite._cryptoKeyStore}),
	toKeystore: (key, dirName) => {
		const filename = `${key._key.prvKeyHex}_sk`;
		const absolutePath = path.resolve(dirName, filename);
		exports.pkcs11_key.save(absolutePath, key);
	},
	save: (path, key) => {
		fsExtra.outputFileSync(path, key.toBytes());
	}

};

exports.toMSP = ({key, certificate, rootCertificate}, cryptoPath, type) => {
	const {cacerts, keystore, signcerts} = cryptoPath.MSPFile(type);
	fsExtra.outputFileSync(signcerts, certificate);
	exports.pkcs11_key.toKeystore(key, keystore);
	fsExtra.outputFileSync(cacerts, rootCertificate);
};
exports.org = {
	saveAdmin: ({certificate, rootCertificate}, cryptoPath, nodeType) => {
		const {ca, msp: {admincerts, cacerts}} = cryptoPath.OrgFile(nodeType);

		fsExtra.outputFileSync(cacerts, rootCertificate);
		fsExtra.outputFileSync(ca, rootCertificate);
		fsExtra.outputFileSync(admincerts, certificate);
	},
	saveTLS: ({rootCertificate}, cryptoPath, nodeType) => {
		const {msp: {tlscacerts}, tlsca} = cryptoPath.OrgFile(nodeType);
		fsExtra.outputFileSync(tlsca, rootCertificate);
		fsExtra.outputFileSync(tlscacerts, rootCertificate);
	}
};
exports.toTLS = ({key, certificate, rootCertificate}, cryptoPath, type) => {
	const {caCert, cert, key: serverKey} = cryptoPath.TLSFile(type);
	const {tlscacerts} = cryptoPath.MSPFile(type);//TLS in msp folder
	exports.pkcs11_key.save(serverKey, key);
	fsExtra.outputFileSync(cert, certificate);
	fsExtra.outputFileSync(caCert, rootCertificate);
	fsExtra.outputFileSync(tlscacerts, rootCertificate);
};

exports.register = registerIfNotExist;
/**
 *
 * @param {string} caUrl
 * @param {string[]} trustedRoots
 * @param {CryptoSuite} cryptoSuite
 * @returns {FabricCAServices}
 */
exports.new = (caUrl, trustedRoots = [], cryptoSuite = ClientUtil.newCryptoSuite()) => {
	const tlsOptions = {
		trustedRoots,
		verify: trustedRoots.length > 0
	};
	return new CAClient(caUrl, tlsOptions, undefined, cryptoSuite);
};
exports.envBuilder = () => {
	return [
		'GODEBUG=netdns=go',
	];
};
exports.toString = (caService) => {
	const caClient = caService._fabricCAClient;
	const returned = {
		caName: caClient._caName,
		hostname: caClient._hostname,
		port: caClient._port,
	};
	const trustedRoots = caClient._tlsOptions.trustedRoots.map(buffer => buffer.toString());
	returned.tlsOptions = {
		trustedRoots,
		verify: caClient._tlsOptions.verify
	};

	return JSON.stringify(returned);
};