import * as _ from 'lodash'
import { updaterStack } from '../utils/intervalUpdater'
import { SupportedToken } from '../types'
import { roundAmount } from './format'

const helper = (stack, token1, token2) => {
  if (stack[token1] && stack[token1].indexOf(token2) === -1) {
    stack[token1].push(token2)
  } else if (!stack[token1]) {
    stack[token1] = [token2]
  }
}

/**
 * ['SNT/ETH', 'SNT/TUSD'] =>
 * {
 *   SNT: ['ETH', 'TUSD']
 *   ETH: ['SNT']
 *   TUSD: ['SNT']
 * }
 */
const transferPairStrArrToTokenStack = (pairStrArr) => {
  const stack = {}
  pairStrArr.forEach(pairStr => {
    const [tokenA, tokenB] = pairStr.split('/')
    helper(stack, tokenA, tokenB)
    helper(stack, tokenB, tokenA)
  })
  return stack
}

export const getSupportedTokens = (): SupportedToken[] => {
  const { tokenListFromImtokenUpdater, pairsFromMMUpdater } = updaterStack
  const tokenStack = transferPairStrArrToTokenStack(pairsFromMMUpdater.cacheResult)
  const tokenList = tokenListFromImtokenUpdater.cacheResult
  const result = []
  tokenList.forEach(token => {
    const { symbol } = token
    const opposites = tokenStack[symbol]
    if (opposites && opposites.length) {
      result.push({
        ...token,
        opposites: opposites.filter(symbol => !!tokenList.find(t => t.symbol === symbol)),
      })
    }
  })
  return result
}

export const isSupportedBaseQuote = (tokens: SupportedToken[], baseQuote): boolean => {
  return tokens.some(t => {
    return t.symbol === baseQuote.base && t.opposites.indexOf(baseQuote.quote) !== -1
  })
}

export const getTokenBySymbol = (tokens, symbol) => {
  return tokens.find(t => t.symbol === symbol)
}

// 处理接口大小写情况，转换为系统设定格式，以及 side BUY 情况的数量调整
export const translateQueryData = (query) => {
  const tokens = getSupportedTokens()
  let updatedBase = null
  let updatedQuote = null
  let updatedAmount = null
  let updatedFeeFactor = null

  if (_.isString(query.base)) {
    const found = tokens.find(t => t.symbol.toUpperCase() === query.base.toUpperCase())
    if (found) {
      updatedBase = found.symbol
    }

    const { amount, side } = query

    if (side === 'BUY') {
      const config = updaterStack.markerMakerConfigUpdater.cacheResult
      const tokenConfigs = updaterStack.tokenConfigsFromImtokenUpdater.cacheResult
      const queryFeeFactor = query.feeFactor
      // 用户 BUY base, 手续费就是 base 的 Token，即 order的 makerToken —— 对应做市商转出的币，用户收到的币
      const foundTokenConfig = tokenConfigs.find(t => t.symbol === query.base)
      updatedFeeFactor = !_.isUndefined(queryFeeFactor) && !_.isNaN(+queryFeeFactor) && +queryFeeFactor >= 0 ? +queryFeeFactor : (
        foundTokenConfig && foundTokenConfig.feeFactor ? foundTokenConfig.feeFactor : (config.feeFactor ? config.feeFactor : 0)
      )
      updatedAmount = amount ? roundAmount(amount / (1 - updatedFeeFactor / 10000), 4) : amount
    }
  }
  if (_.isString(query.quote)) {
    const found = tokens.find(t => t.symbol.toUpperCase() === query.quote.toUpperCase())
    if (found) {
      updatedQuote = found.symbol
    }
  }

  const result = { ...query }

  Object.entries({
    base: updatedBase,
    quote: updatedQuote,
    amount: updatedAmount,
    feeFactor: updatedFeeFactor,
  }).forEach(([key, value]) => {
    if (value) {
      Object.assign(result, {
        [key]: value,
      })
    }
  })

  return result
}