import { assert } from 'chai'
import 'mocha'
import * as suppressLogs from 'mocha-suppress-logs'
import { Wallet, utils } from 'ethers'
import { newOrder } from '../src/handler'
import { updaterStack, Updater } from '../src/worker'
import { NULL_ADDRESS } from '../src/constants'
import { Protocol } from '../src/types'
import { SignatureType } from '../src/signer/rfqv1'
import { getOrderSignDigest } from '../src/signer/orderHash'
import { BigNumber } from '../src/utils'

describe('NewOrder', function () {
  suppressLogs()

  const signer = Wallet.createRandom()

  beforeEach(function () {
    const mockMarkerMakerConfigUpdater = new Updater({
      name: 'mockMarkerMakerConfigUpdater',
      updater() {
        return Promise.resolve({})
      },
    })
    mockMarkerMakerConfigUpdater.cacheResult = {
      mmId: 1,
      mmProxyContractAddress: signer.address.toLowerCase(),
      tokenlonExchangeContractAddress: '0xd489f1684cf5e78d933e254bd7ac8a9a6a70d491',
      exchangeContractAddress: '0x30589010550762d2f0d06f650d8e8b6ade6dbf4b',
      userProxyContractAddress: '0x25657705a6be20511687d483f2fccfb2d92f6033',
      wethContractAddress: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
      orderExpirationSeconds: 600,
      feeFactor: 30,
      addressBookV5: {
        Tokenlon: '0xF1eC89551112da48C3b43B5a167AF0b2a7Cc2614',
        PMM: '0x7bd7d025D4231aAD1233967b527FFd7416410257',
        AMMWrapper: '0xCF011536f10e85e376E70905EED4CA9eA8Cded34',
        RFQ: '0xfD474E4809e690626C67ECb7A908de4b9c464b99',
      },
    }
    const mockTokenConfigsFromImtokenUpdater = new Updater({
      name: 'mockTokenConfigsFromImtokenUpdater',
      updater() {
        return Promise.resolve({})
      },
    })
    mockTokenConfigsFromImtokenUpdater.cacheResult = []
    const mockTokenListUpdate = new Updater({
      name: 'mockTokenListUpdate',
      updater() {
        return Promise.resolve({})
      },
    })
    mockTokenListUpdate.cacheResult = [
      {
        symbol: 'ETH',
        contractAddress: NULL_ADDRESS,
        decimal: 18,
        precision: 4,
        minTradeAmount: 0.01,
        maxTradeAmount: 10,
      },
      {
        symbol: 'USDT',
        contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        decimal: 6,
        precision: 4,
        minTradeAmount: 1,
        maxTradeAmount: 1000,
      },
    ]
    const mockPairsFromMMUpdater = new Updater({
      name: 'mockPairsFromMMUpdater',
      updater() {
        return Promise.resolve({})
      },
    })
    mockPairsFromMMUpdater.cacheResult = ['USDT/ETH']
    updaterStack['tokenListFromImtokenUpdater'] = mockTokenListUpdate
    updaterStack['pairsFromMMUpdater'] = mockPairsFromMMUpdater
    updaterStack['markerMakerConfigUpdater'] = mockMarkerMakerConfigUpdater
    updaterStack['tokenConfigsFromImtokenUpdater'] = mockTokenConfigsFromImtokenUpdater
  })

  describe('dispatch to protocol signer', function () {
    it('should raise error for pmmv4 order', async function () {
      assert.equal(
        await newOrder({
          signer: Wallet.createRandom(),
          quoter: {
            getPrice: () => {
              return Promise.resolve({
                result: true,
                exchangeable: true,
                minAmount: 0,
                maxAmount: 1000,
                price: 1,
                quoteId: 'echo-testing-9999',
              })
            },
          },
          query: {
            base: 'ETH',
            quote: 'USDT',
            side: 'SELL',
            amount: 0.1,
            uniqId: 'testing-1111',
            userAddr: Wallet.createRandom().address.toLowerCase(),
            protocol: 'PMMV4',
          },
        }),
        'Unrecognized protocol: PMMV4'
      )
    })

    it('should signed pmmv5 order by MMP', async function () {
      const signedOrderResp = await newOrder({
        signer: Wallet.createRandom(),
        quoter: {
          getPrice: () => {
            return Promise.resolve({
              result: true,
              exchangeable: true,
              minAmount: 0,
              maxAmount: 1000,
              price: 1,
              quoteId: 'echo-testing-8888',
            })
          },
        },
        query: {
          base: 'ETH',
          quote: 'USDT',
          side: 'SELL',
          amount: 0.1,
          uniqId: 'testing-1111',
          userAddr: Wallet.createRandom().address.toLowerCase(),
          protocol: Protocol.PMMV5,
        },
      })

      assert(signedOrderResp)
      assert.equal(signedOrderResp.order.quoteId, '1--echo-testing-8888')
      assert.equal(signedOrderResp.order.makerWalletSignature.slice(-1), '4')
    })

    it('should signed pmmv5 order by EOA', async function () {
      const signedOrderResp = await newOrder({
        signer: signer,
        quoter: {
          getPrice: () => {
            return Promise.resolve({
              result: true,
              exchangeable: true,
              minAmount: 0,
              maxAmount: 1000,
              price: 1,
              quoteId: 'echo-testing-8888',
            })
          },
        },
        query: {
          base: 'ETH',
          quote: 'USDT',
          side: 'SELL',
          amount: 0.1,
          uniqId: 'testing-1111',
          userAddr: Wallet.createRandom().address.toLowerCase(),
          protocol: Protocol.PMMV5,
        },
      })

      assert(signedOrderResp)
      assert.equal(signedOrderResp.order.quoteId, '1--echo-testing-8888')
      assert.equal(signedOrderResp.order.makerWalletSignature.slice(-1), '3')
    })

    it('should signed rfqv1 order by MMP', async function () {
      const signedOrderResp = await newOrder({
        signer: Wallet.createRandom(),
        chainID: 1,
        quoter: {
          getPrice: () => {
            return Promise.resolve({
              result: true,
              exchangeable: true,
              minAmount: 0,
              maxAmount: 1000,
              price: 1,
              quoteId: 'echo-testing-8888',
            })
          },
        },
        query: {
          base: 'ETH',
          quote: 'USDT',
          side: 'SELL',
          amount: 0.1,
          uniqId: 'testing-1111',
          userAddr: Wallet.createRandom().address.toLowerCase(),
          protocol: Protocol.RFQV1,
        },
      })

      assert(signedOrderResp)
      assert.equal(signedOrderResp.order.quoteId, '1--echo-testing-8888')

      const sigBytes = utils.arrayify(signedOrderResp.order.makerWalletSignature)
      assert.equal(sigBytes.length, 88)
      assert.equal(sigBytes[87], SignatureType.Wallet)
    })

    it('should signed rfqv1 order by EOA', async function () {
      const signedOrderResp = await newOrder({
        signer: signer,
        chainID: 1,
        quoter: {
          getPrice: () => {
            return Promise.resolve({
              result: true,
              exchangeable: true,
              minAmount: 0,
              maxAmount: 1000,
              price: 1,
              quoteId: 'echo-testing-8888',
            })
          },
        },
        query: {
          base: 'ETH',
          quote: 'USDT',
          side: 'SELL',
          amount: 0.1,
          uniqId: 'testing-1111',
          userAddr: Wallet.createRandom().address.toLowerCase(),
          protocol: Protocol.RFQV1,
        },
      })

      assert(signedOrderResp)
      assert.equal(signedOrderResp.order.quoteId, '1--echo-testing-8888')

      const sigBytes = utils.arrayify(signedOrderResp.order.makerWalletSignature)
      assert.equal(sigBytes.length, 98)
      assert.equal(sigBytes[97], SignatureType.EthSign)

      const rfqAddr = updaterStack['markerMakerConfigUpdater'].cacheResult.addressBookV5.RFQ
      const orderHash = getOrderSignDigest(signedOrderResp.order, 1, rfqAddr)
      const recoved = utils.verifyMessage(orderHash, utils.hexlify(sigBytes.slice(0, 65)))
      assert.equal(recoved.toLowerCase(), signer.address.toLowerCase())
    })
  })

  describe('handle token precision and decimals', () => {
    it('should format taker asset amount', async function () {
      const signedOrderResp = await newOrder({
        signer: Wallet.createRandom(),
        quoter: {
          getPrice: () => {
            return Promise.resolve({
              result: true,
              exchangeable: true,
              minAmount: 0,
              maxAmount: 1000,
              price: 1.1,
              quoteId: 'echo-testing-8888',
            })
          },
        },
        query: {
          base: 'ETH',
          quote: 'USDT',
          side: 'BUY',
          amount: 0.1111,
          feeFactor: 10,
          uniqId: 'testing-1111',
          userAddr: Wallet.createRandom().address.toLowerCase(),
          protocol: Protocol.PMMV5,
        },
      })

      assert(signedOrderResp)
      assert.equal(signedOrderResp.order.quoteId, '1--echo-testing-8888')
      assert.equal(signedOrderResp.order.makerWalletSignature.slice(-1), '4')
      assert.equal(
        signedOrderResp.order.takerAssetData.slice(34),
        'dac17f958d2ee523a2206206994597c13d831ec7'
      )
      assert.equal(
        signedOrderResp.order.takerAssetAmount,
        utils.parseUnits('0.122539', 6).toString()
      )
      assert.equal(signedOrderResp.order.makerAssetAmount, utils.parseEther('0.1114').toString())
    })

    it('should format maker asset amount', async function () {
      const signedOrderResp = await newOrder({
        signer: Wallet.createRandom(),
        quoter: {
          getPrice: () => {
            return Promise.resolve({
              result: true,
              exchangeable: true,
              minAmount: 0,
              maxAmount: 1000,
              price: 1.1,
              quoteId: 'echo-testing-8888',
            })
          },
        },
        query: {
          base: 'ETH',
          quote: 'USDT',
          side: 'SELL',
          amount: 0.1111,
          uniqId: 'testing-1111',
          userAddr: Wallet.createRandom().address.toLowerCase(),
          protocol: Protocol.PMMV5,
        },
      })

      assert(signedOrderResp)
      assert.equal(signedOrderResp.order.quoteId, '1--echo-testing-8888')
      assert.equal(signedOrderResp.order.makerWalletSignature.slice(-1), '4')
      assert.equal(signedOrderResp.order.takerAssetAmount, utils.parseEther('0.1111').toString())
      assert.equal(
        signedOrderResp.order.makerAssetAmount,
        utils.parseUnits('0.12221', 6).toString()
      )
    })
  })

  it('test get RFQ order hash', () => {
    const rfqAddr = '0x6b6D3C4EF634731E17d31d0D6017ba9DB4775955'
    const order = {
      takerAddr: '0x6813Eb9362372EEF6200f3b1dbC3f819671cBA69',
      makerAddr: '0x86B9F429C3Ef44c599EB560Eb531A0E3f2E36f64',
      takerAssetAddr: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      makerAssetAddr: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      takerAssetAmount: new BigNumber('0x0de0b6b3a7640000'),
      makerAssetAmount: new BigNumber('0x05f5e100'),
      salt: new BigNumber('0x44df74b1c54e9792989c61fedcef6f94b534b58933cde70bc456ec74cf4d3610'),
      deadline: 1620444917,
      feeFactor: 30,
    }
    let orderHash = getOrderSignDigest(order, 1, rfqAddr)
    assert.equal(orderHash, '0x8d70993864d87daa0b2bae0c2be1c56067f45363680d0dca8657e1e51d1d6a40')
  })
})
