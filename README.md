# fabric-common

Latest version 1.2.0
# Installation




# build environment for release-1.1

1. golang 1.9 install 
`./install.sh golang1_9`  
this will take effect in **new terminal**
2. docker 17.12, jq 1.5 install 
`./docker/install.sh`
3. grand current OS user to docker group
`./docker/dockerSUDO.sh` 
this will take effect in current terminal, **Logout is required for system-wide applied**
4. libtool install 
`./install.sh install_libtool` 

5. get fabric into GOPATH
`go get -u github.com/hyperledger/fabric`
6. switch fabric source to branch `release-1.1`
```
cd $(go env GOPATH)/src/github.com/hyperledger/fabric
git checkout release-1.1
```
7. make
`make dist-clean all`
