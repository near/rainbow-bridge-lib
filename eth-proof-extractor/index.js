const Tree = require('merkle-patricia-tree')
const { Header, Proof, Receipt, Log } = require('eth-object')
const { encode } = require('eth-util-lite')
const { promisfy } = require('promisfy')
const { RobustWeb3 } = require('../rainbow/robust')

class EthProofExtractor {
  constructor(ethNodeURL) {
    // @ts-ignore
    this.robustWeb3 = new RobustWeb3(ethNodeURL)
    this.web3 = this.robustWeb3.web3
  }

  async buildTrie(block) {
    const blockReceipts = await Promise.all(
      block.transactions.map((t) => this.robustWeb3.getTransactionReceipt(t))
    )
    // Build a Patricia Merkle Trie
    const tree = new Tree()
    await Promise.all(
      blockReceipts.map((receipt) => {
        const path = encode(receipt.transactionIndex)
        const serializedReceipt = receiptFromWeb3(receipt).serialize()
        return promisfy(tree.put, tree)(path, serializedReceipt)
      })
    )
    return tree
  }

  async extractProof(block, tree, transactionIndex) {
    const [, , stack] = await promisfy(
      tree.findPath,
      tree
    )(encode(transactionIndex))

    // is this necessary? how different are these?
    //   * robustWeb3.getBlock (the passed-in block)
    //   * robustWeb3.web3.eth.getBlock
    const blockData = await this.web3.eth.getBlock(block.number)
    // Correctly compose and encode the header.
    const header = Header.fromWeb3(blockData)
    return {
      header_rlp: header.serialize(),
      receiptProof: Proof.fromStack(stack),
      txIndex: transactionIndex,
    }
  }

  destroy() {
    if (this.web3.currentProvider.connection.close) {
      // Only WebSocket provider has close, HTTPS don't
      this.web3.currentProvider.connection.close()
    }
  }
}

exports.EthProofExtractor = EthProofExtractor
