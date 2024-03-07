import { createContext, useCallback, useContext, useMemo } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { AccountInfo, PublicKey, TokenAmount } from '@solana/web3.js';
import { AccountLayout, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { useQueryClient } from '@tanstack/react-query';
import { BN } from '@coral-xyz/anchor';
import { META_BASE_LOTS, Token, USDC_BASE_LOTS, useTokens } from '@/hooks/useTokens';
import { useProposalMarkets } from './ProposalMarketsContext';
import useAccountSubscription from '@/hooks/useAccountSusbcription';

export const defaultAmount: TokenAmount = {
  amount: '0.0',
  decimals: 0.0,
  uiAmount: 0.0,
};

type Balances = { [token: string]: TokenAmount };

export interface BalancesInterface {
  balances: Balances;
  setBalance(publicKey: PublicKey, amount: TokenAmount): void;
  setBalanceByMint(mint: PublicKey, stateUpdater: (oldAmount: TokenAmount) => TokenAmount): void;
  /**
   * @deprecated
   * Manually refetch
   * This function is deprecated and we should replace this with a direct update to the state to avoid expensive refetches.
   * @param publicKey address of the associated token account to be fetched
   */
  fetchBalance(publicKey: PublicKey): void;
  /**
   * @deprecated
   * Manually refetch
   * This function is deprecated and we should replace this with a direct update to the state to avoid expensive refetches.
   * @param publicKey address of the associated token account to be fetched
   */
  fetchBalanceByMint(publicKey: PublicKey): void;
}

export const balancesContext = createContext<BalancesInterface>({
  balances: {},
  setBalance: () => {},
  setBalanceByMint: () => {},
  fetchBalance: () => {},
  fetchBalanceByMint: () => {},
});

export const useBalances = () => {
  const context = useContext(balancesContext);
  if (!context) {
    throw new Error('useBalances must be used within a BalancesContextProvider');
  }
  return context;
};

export function BalancesProvider({
  children,
  owner,
}: {
  children: React.ReactNode;
  owner?: PublicKey;
}) {
  const { markets } = useProposalMarkets();
  const queryClient = useQueryClient();
  const { connection } = useConnection();
  const { tokens } = useTokens();

  const metaMints = [
    tokens.meta?.publicKey,
    markets?.baseVault.conditionalOnFinalizeTokenMint,
    markets?.baseVault.conditionalOnRevertTokenMint,
  ];

  const metaMintsString = useMemo(
    () => metaMints.map((m) => m?.toString()).filter((m): m is string => !!m),
    [metaMints],
  );

  const getAta = useCallback(
    (publicKey: PublicKey | undefined) => {
      if (publicKey && owner) {
        return getAssociatedTokenAddressSync(publicKey, owner);
      }
    },
    [owner],
  );

  const accountSubscriptionCallback = useCallback(
    (accountInfo: AccountInfo<Buffer>) => {
      const accountData = AccountLayout.decode(accountInfo.data);
      const isMeta = metaMintsString.includes(accountData.mint.toString());

      const relatedToken = isMeta
        ? { decimals: tokens.meta?.decimals, baseLots: META_BASE_LOTS }
        : { decimals: tokens.usdc?.decimals, baseLots: USDC_BASE_LOTS };
      if (!relatedToken) {
        return;
      }
      const dividedTokenAmount = new BN(accountData.amount) / new BN(relatedToken.baseLots);
      const tokenVal: TokenAmount = {
        amount: dividedTokenAmount.toString(),
        decimals: relatedToken?.decimals ?? 0,
        uiAmount: dividedTokenAmount,
        uiAmountString: dividedTokenAmount.toString(),
      };

      return tokenVal;
    },
    [metaMints, META_BASE_LOTS, USDC_BASE_LOTS],
  );

  const fetchBalance = useCallback(
    async (ata: PublicKey | undefined) => {
      if (connection && owner && ata) {
        try {
          const amount = await queryClient.fetchQuery({
            queryKey: ['accountData', ata],
            queryFn: async () => connection.getTokenAccountBalance(ata),
          });
          return amount.value;
        } catch (err) {
          console.error(
            `Error with this account fetch ${ata.toString()} (owner: ${owner.toString()}), please review issue and solve.`,
          );
          return defaultAmount;
        }
      } else {
        return defaultAmount;
      }
    },
    [connection, owner],
  );
  const fetchBalanceByMint = useCallback(
    async (mint: PublicKey | undefined) => {
      if (connection && owner && mint) {
        try {
          const ata = getAta(mint);
          if (ata) {
            const amount = await queryClient.fetchQuery({
              queryKey: ['accountData', ata],
              queryFn: async () => connection.getTokenAccountBalance(ata),
            });
            return amount.value;
          }
          throw new Error(`Associated token address could not be found from mint: ${mint}`);
        } catch (err) {
          console.error(
            `Error with this account fetch. (owner: ${owner.toString()}), please review issue and solve.`,
          );
          return defaultAmount;
        }
      } else {
        return defaultAmount;
      }
    },
    [connection, owner],
  );

  const metaAta = useMemo(() => getAta(tokens.meta?.publicKey), [tokens.meta?.publicKey, owner]);
  const [{ data: metaBalance }, setMetaBalance] = useAccountSubscription<TokenAmount | undefined>({
    publicKey: metaAta,
    handler: accountSubscriptionCallback,
    fetch: fetchBalance,
  });
  const pMetaAta = useMemo(
    () => getAta(markets?.baseVault.conditionalOnFinalizeTokenMint),
    [markets?.baseVault.conditionalOnFinalizeTokenMint],
  );
  const [{ data: pMetaBalance }, setPmetaBalance] = useAccountSubscription<TokenAmount | undefined>(
    {
      publicKey: pMetaAta,
      handler: accountSubscriptionCallback,
      fetch: fetchBalance,
    },
  );
  const fMetaAta = useMemo(
    () => getAta(markets?.baseVault.conditionalOnRevertTokenMint),
    [markets?.baseVault.conditionalOnRevertTokenMint],
  );
  const [{ data: fMetaBalance }, setFmetaBalance] = useAccountSubscription<TokenAmount | undefined>(
    {
      publicKey: fMetaAta,
      handler: accountSubscriptionCallback,
      fetch: fetchBalance,
    },
  );
  const usdcAta = useMemo(() => getAta(tokens.usdc?.publicKey), [tokens.usdc?.publicKey]);
  const [{ data: usdcBalance }, setUsdcBalance] = useAccountSubscription<TokenAmount | undefined>({
    publicKey: usdcAta,
    handler: accountSubscriptionCallback,
    fetch: fetchBalance,
  });
  const pUsdcAta = useMemo(
    () => getAta(markets?.quoteVault.conditionalOnFinalizeTokenMint),
    [markets?.quoteVault.conditionalOnFinalizeTokenMint, owner],
  );
  const [{ data: pUsdcBalance }, setPUsdcBalance] = useAccountSubscription<TokenAmount | undefined>(
    {
      publicKey: pUsdcAta,
      handler: accountSubscriptionCallback,
      fetch: fetchBalance,
    },
  );
  const fUsdcAta = useMemo(
    () => getAta(markets?.quoteVault.conditionalOnFinalizeTokenMint),
    [markets?.quoteVault.conditionalOnFinalizeTokenMint, owner],
  );
  const [{ data: fUsdcBalance }, setFUsdcBalance] = useAccountSubscription<TokenAmount | undefined>(
    {
      publicKey: fUsdcAta,
      handler: accountSubscriptionCallback,
      fetch: fetchBalance,
    },
  );

  const balances: Balances = {
    [metaAta?.toString() ?? '']: metaBalance ?? defaultAmount,
    [pMetaAta?.toString() ?? '']: pMetaBalance ?? defaultAmount,
    [fMetaAta?.toString() ?? '']: fMetaBalance ?? defaultAmount,
    [usdcAta?.toString() ?? '']: usdcBalance ?? defaultAmount,
    [pUsdcAta?.toString() ?? '']: pUsdcBalance ?? defaultAmount,
    [fUsdcAta?.toString() ?? '']: fUsdcBalance ?? defaultAmount,
  };
  const balanceSetters = {
    [metaAta?.toString() ?? '']: setMetaBalance,
    [pMetaAta?.toString() ?? '']: setPmetaBalance,
    [fMetaAta?.toString() ?? '']: setFmetaBalance,
    [usdcAta?.toString() ?? '']: setUsdcBalance,
    [pUsdcAta?.toString() ?? '']: setPUsdcBalance,
    [fUsdcAta?.toString() ?? '']: setFUsdcBalance,
  };

  function setBalance(publicKey: PublicKey, amount: TokenAmount) {
    balanceSetters[publicKey.toString()](amount);
  }
  function setBalanceByMint(
    mint: PublicKey,
    stateUpdater: (oldAmount: TokenAmount) => TokenAmount,
  ) {
    const ata = getAta(mint);
    if (ata) {
      const newAmount = stateUpdater(balances[ata.toString()]);
      balanceSetters[ata.toString()](newAmount);
    }
  }

  return (
    <balancesContext.Provider
      value={{
        balances,
        setBalance,
        setBalanceByMint,
        fetchBalance,
        fetchBalanceByMint,
      }}
    >
      {children}
    </balancesContext.Provider>
  );
}
