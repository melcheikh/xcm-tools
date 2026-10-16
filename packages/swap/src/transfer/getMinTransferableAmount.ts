import { getExistentialDeposit, getNativeAssetSymbol } from '@paraspell/sdk-core';

import type ExchangeChain from '../exchanges/ExchangeChain';
import type { TBuildTransactionsOptions } from '../types';
import type { TTransformedOptions } from '../types/TRouter';
import { getSwapFee } from './fees';
import {
  createToExchangeBuilder,
  getFromExchangeFee,
  prepareTransformedOptions,
  validateTransferOptions,
} from './utils';

const computeExchangeMinAmount = async <TApi, TRes, TSigner, TCustomChain extends string = never>(
  dex: ExchangeChain,
  options: TTransformedOptions<
    TBuildTransactionsOptions<TApi, TRes, TSigner, TCustomChain>,
    TApi,
    TRes,
    TSigner,
    TCustomChain
  >,
): Promise<bigint> => {
  const { exchange, destination, sender, api } = options;

  const existentialDeposit = getExistentialDeposit(exchange.chain, {
    location: exchange.assetFrom.location,
  });

  const nativeSymbol = getNativeAssetSymbol(exchange.chain);
  const isNativeAsset = exchange.assetFrom.symbol === nativeSymbol;

  if (!isNativeAsset) {
    return existentialDeposit + 1n;
  }

  const { result, amountOut } = await getSwapFee(dex, options);
  let swapFee = result.fee ?? 0n;

  if (destination && destination.chain !== exchange.chain) {
    const receivingChain = await getFromExchangeFee(
      { exchange, destination, amount: amountOut, sender, api },
      false,
    );
    swapFee += receivingChain.origin.fee ?? 0n;
  }

  return existentialDeposit + swapFee + 1n;
};

export const getMinTransferableAmount = async <
  TApi,
  TRes,
  TSigner,
  TCustomChain extends string = never,
>(
  initialOptions: TBuildTransactionsOptions<TApi, TRes, TSigner, TCustomChain>,
): Promise<bigint> => {
  validateTransferOptions(initialOptions);

  const { dex, options } = await prepareTransformedOptions(initialOptions);

  const { origin, exchange, sender, evmSenderAddress, amount, api } = options;

  if (origin) {
    const builder = createToExchangeBuilder({
      origin,
      exchange,
      sender,
      evmSenderAddress,
      amount,
      api,
    });

    return builder.getMinTransferableAmount();
  }

  return computeExchangeMinAmount(dex, options);
};
