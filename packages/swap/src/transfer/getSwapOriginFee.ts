import type { TXcmFeeDetailWithForwardedXcm } from '@paraspell/sdk-core';

import type ExchangeChain from '../exchanges/ExchangeChain';
import type { TBuildTransactionsOptions, TTransformedOptions } from '../types';
import { getSwapFee } from './fees';
import {
  canUseExecuteTransfer,
  getFromExchangeFee,
  getSwapExecuteOriginXcmFee,
  getToExchangeOriginFee,
  isFilteredError,
  validateRoutedFeeAsset,
} from './utils';

export const getSwapOriginFee = async <
  TApi,
  TRes,
  TSigner,
  TDisableFallback extends boolean,
  TCustomChain extends string = never,
>(
  dex: ExchangeChain,
  options: TTransformedOptions<
    TBuildTransactionsOptions<TApi, TRes, TSigner, TCustomChain>,
    TApi,
    TRes,
    TSigner,
    TCustomChain
  >,
  disableFallback: TDisableFallback,
): Promise<TXcmFeeDetailWithForwardedXcm<TDisableFallback>> => {
  const { origin, exchange, destination } = options;

  if (canUseExecuteTransfer(dex, options)) {
    try {
      return await getSwapExecuteOriginXcmFee(dex, options, disableFallback);
    } catch (error) {
      if (!isFilteredError(error)) throw error;
      // Fall through to routed path
    }
  }

  validateRoutedFeeAsset(options);

  // Origin chain is upstream from the exchange: fee is the cost of origin -> exchange
  if (origin && origin.chain !== exchange.chain) {
    return getToExchangeOriginFee({ ...options, origin }, disableFallback);
  }

  // Origin chain is the exchange itself: fee is the swap fee (+ destination origin fee if routed to dest)
  const { result, amountOut } = await getSwapFee(dex, options, disableFallback);

  if (destination && destination.chain !== exchange.chain) {
    const receivingChain = await getFromExchangeFee(
      { exchange, destination, amount: amountOut, sender: options.sender, api: options.api },
      disableFallback,
    );
    return {
      ...result,
      fee: (result.fee ?? 0n) + (receivingChain.origin.fee ?? 0n),
    } as TXcmFeeDetailWithForwardedXcm<TDisableFallback>;
  }

  return result as TXcmFeeDetailWithForwardedXcm<TDisableFallback>;
};
