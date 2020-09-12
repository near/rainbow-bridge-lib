const nearAPI = require('near-api-js');
const homedir = require('os').homedir();
const path = require('path');
const fs = require('fs');
const Web3 = require('web3');

const CREDENTIALS_DIR = '.near-credentials';
const PROJECT_KEY_DIR = './neardev';

/**
 * Remove 0x if prepended
 * @param {String} value value to check and modify
 * @return {String} string without 0x
 */
function remove0x(value) {
    assert(typeof value === 'string', 'remove0x: must pass in string');

    if (value.slice(0, 2) === '0x') {
        return value.slice(2);
    } else {
        return value;
    }
};

function normalizeHex(value) {
    value = value.toLowerCase()
    if (!value.startsWith('0x')) {
        return `0x${value}`;
    }
    return value;
}

async function accountExists(connection, accountId) {
    try {
        const account = new nearAPI.Account(connection, accountId);
        console.log(account, connection);
        await account.state();
        return true;
    } catch (error) {
        if (!error.message.includes('does not exist while viewing')) {
            throw error;
        }
        return false;
    }
}

async function createLocalKeyStore(networkId, keyPath) {
    // TODO: this should live in near-api-js
    const credentialsPath = path.join(homedir, CREDENTIALS_DIR);
    const keyStores = [
        new nearAPI.keyStores.UnencryptedFileSystemKeyStore(credentialsPath),
        new nearAPI.keyStores.UnencryptedFileSystemKeyStore(PROJECT_KEY_DIR)
    ];
    if (keyPath) {
        const account = JSON.parse(fs.readFileSync(keyPath).toString());
        const keyPair = nearAPI.utils.KeyPair.fromString(account.secret_key);
        const keyStore = new nearAPI.keyStores.InMemoryKeyStore();
        keyStore.setKey(networkId, account.account_id, keyPair).then(() => { });
        keyStores.push(keyStore);
    }
    return { keyStore: new nearAPI.keyStores.MergeKeyStore(keyStores) };
}

function getWeb3(config) {
    // TODO: add RobustWeb3 usage here.
    return new Web3(config.ethNodeUrl);
}

function getEthContract(web3, path, address) {
    const bin = fs.readFileSync(`${path}.full.bin`);
    const abi = fs.readFileSync(`${path}.full.abi`);
    const contract = new web3.eth.Contract(JSON.parse(abi), address);
    contract.bin = bin;
    return contract;
}

function addSecretKey(web3, secretKey) {
    let account = web3.eth.accounts.privateKeyToAccount(normalizeHex(secretKey));
    web3.eth.accounts.wallet.add(account);
    return account.address;
}

module.exports = { 
    accountExists,
    remove0x,
    createLocalKeyStore,
    getWeb3,
    getEthContract,
    addSecretKey
};
