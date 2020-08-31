import { expect } from 'chai'
import 'mocha'
import { signOrderByMaker } from '../src/0x/v3'
import { PrivateKeyWalletSubprovider } from '@0x/subproviders'
import { Wallet } from 'ethers'

describe('0x/v3/sign_order', function () {
  it('signOrderByMaker', async function () {
    const randomWallet = Wallet.createRandom()
    const randomMakerWallet = Wallet.createRandom()
    const pkw = new PrivateKeyWalletSubprovider(randomWallet.privateKey.slice(2))
    const signedOrder = await signOrderByMaker(
      {
        chainID: 42,
        userAddr: randomWallet.address,
        makerAddr: randomMakerWallet.address,
        rate: 200,
        simpleOrder: {
          base: 'ETH',
          quote: 'DAI',
          side: 'BUY',
          amount: 1,
        },
        tokenConfigs: [],
        tokenList: [
          {
            symbol: 'WETH',
            decimal: 18,
            contractAddress: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
          },
          {
            symbol: 'ETH',
            decimal: 18,
            contractAddress: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
          },
          {
            symbol: 'DAI',
            decimal: 18,
            contractAddress: '0xc7cc3413f169a027dccfeffe5208ca4f38ef0c40',
          },
        ],
      },
      pkw
    )
    expect(signedOrder.chainId).to.eq(42)
    expect(signedOrder.makerAddress).to.eq(randomMakerWallet.address)
    expect(signedOrder.signature.length).to.greaterThan(0)
  })
})
