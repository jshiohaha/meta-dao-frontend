import { Group, Loader, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  SignatureResult,
  Transaction,
  VersionedTransaction
} from '@solana/web3.js';
import { IconCircleCheck, IconCircleX, IconExclamationCircle } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { useExplorerConfiguration } from './useExplorerConfiguration';

// copy '@solana/web3.js' since unable to import const enum when `isolatedModules` is enabled
enum TransactionStatus {
  BLOCKHEIGHT_EXCEEDED = 0,
  PROCESSED = 1,
  TIMED_OUT = 2,
  NONCE_INVALID = 3,
}

type TransactionWithMetadata<T extends Transaction | VersionedTransaction> = {
  tx: T;
  canonicalDescriptor?: string;
};

// Type guard function
const isTransactionWithMeta = <T extends Transaction | VersionedTransaction>(
  obj: any,
): obj is TransactionWithMetadata<T> => {
  return typeof obj === 'object' && obj !== null && 'tx' in obj;
};

const randomInRange = (start: number, end: number) =>
  Math.floor(Math.random() * (end - start + 1) + start);

const generateSignature = (length: number) => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; // Characters to include in the random string
  let result = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length); // Generate a random index within the character set
    result += charset.charAt(randomIndex); // Add the character at the random index to the result string
  }

  return result;
};

type SingleOrArray<T> = T | T[];

type TransactionInfo<T extends Transaction | VersionedTransaction> = {
  signature: string;
  transaction: TransactionWithMetadata<T>;
  result?: SignatureResult;
  status?: TransactionStatus;
};

export const useDummyTransactionSender = <T extends Transaction | VersionedTransaction>() => {
  const { generateExplorerLink } = useExplorerConfiguration();

  const [idToTransactionInfos, setIdToTransactionInfos] = useState<
    Record<string, Array<TransactionInfo<T>>>
  >({});
  const [successfulSignatureCount, setSuccessfulSignatureCount] = useState<Record<string, number>>(
    {},
  );
  const [idsToClear, setIdsToClear] = useState<Array<string>>([]);

  const updateSingleTransactionInfo = (
    signature: string,
    id: string,
    fn: () => Partial<TransactionInfo<T>>,
  ) => {
    setIdToTransactionInfos((state) => {
      if (!state[id]) return state;
      const indexToUpdate = state[id].findIndex((x) => x.signature === signature);

      // no transaction info for id, ignore
      if (indexToUpdate === -1) return state;
      return {
        ...state,
        [id]: [
          ...(indexToUpdate === 0 ? [] : state[id].slice(0, indexToUpdate)),
          {
            ...state[id][indexToUpdate],
            ...fn(),
          },
          // start index is inclusive, add 1 to skip the updated element
          ...(indexToUpdate + 1 >= state[id].length ? [] : state[id].slice(indexToUpdate + 1)),
        ],
      };
    });
  };

  const onNotificationClose = (id: string) => setIdsToClear((state) => [...state, id]);

  const asyncClearStateForNotificationId = () => {
    idsToClear.forEach((id) => {
      if (!(id in idToTransactionInfos)) return;

      // remove successful count for notification id
      setSuccessfulSignatureCount((state) =>
        Object.keys(state).reduce((acc, o) => {
          if (o === id) return acc;
          return {
            ...acc,
            [o]: state[o],
          };
        }, {} as Record<string, number>),
      );

      // remove Array<TransactionInfo<T>> for notification id
      setIdToTransactionInfos((state) =>
        Object.keys(state).reduce((acc, o) => {
          if (o === id) return acc;
          return {
            ...acc,
            [o]: state[o],
          };
        }, {} as Record<string, Array<TransactionInfo<T>>>),
      );
    });
  };

  const generateDefaultNotificationOptions = () => ({
    withCloseButton: true,
    onClose: (props: any) => {
      onNotificationClose(props.id);
    },
    loading: false,
    autoClose: false,
    color: 'var(--mantine-color-dark-4)',
  });

  const isTransactionSuccessful = (transactionInfo: TransactionInfo<T>) =>
    transactionInfo.result !== undefined && transactionInfo.result.err === null;
  const isTransactionFailed = (transactionInfo: TransactionInfo<T>) =>
    transactionInfo.result !== undefined && transactionInfo.result.err !== null;
  const isTransactionUnconfirmed = (transactionInfo: TransactionInfo<T>) =>
    transactionInfo.status === TransactionStatus.TIMED_OUT;

  const generateTitle = (transactionInfos: Array<TransactionInfo<T>>, notificationId?: string) => {
    if (transactionInfos.length === 1) {
      const transactionInfo = transactionInfos[0];

      if (isTransactionSuccessful(transactionInfo)) return 'Transaction Succeeded';
      if (isTransactionUnconfirmed(transactionInfo)) return 'Unable to Confirm Transaction Status';
      if (isTransactionFailed(transactionInfo)) return 'Transaction Failed';

      return 'Confirming transaction';
    }

    return `Confirmed ${notificationId ? successfulSignatureCount[notificationId] ?? 0 : 0} of ${
      transactionInfos.length
    } transactions`;
  };

  const generateNotficationBody = (transactionInfos: Array<TransactionInfo<T>>) => {
    return (
      <>
        {transactionInfos.map((transactionInfo, idx) => {
          const {
            transaction: { canonicalDescriptor },
            signature,
          } = transactionInfo;

          return (
            <Group align="flex-start" key={idx}>
              {renderSignatureIcon(transactionInfo)}
              <Text>
                <a
                  href={generateExplorerLink(signature, 'transaction')}
                  target="blank"
                  onClick={(e) => e.stopPropagation()}
                  style={{ textDecoration: 'underline', fontWeight: '400' }}
                >
                  View Transaction
                </a>
                {': '}
                {canonicalDescriptor ? canonicalDescriptor : `Transaction ${idx + 1}`}
              </Text>
            </Group>
          );
        })}
      </>
    );
  };

  const renderSignatureIcon = (transactionInfo: TransactionInfo<T>) => {
    if (isTransactionSuccessful(transactionInfo)) {
      return (
        <IconCircleCheck
          stroke={2}
          style={{ width: '1.25rem', height: '1.25rem' }}
          color="var(--mantine-color-green-filled)"
        />
      );
    } else if (isTransactionFailed(transactionInfo)) {
      return (
        <IconCircleX
          stroke={2}
          style={{ width: '1.25rem', height: '1.25rem' }}
          color="var(--mantine-color-red-filled)"
        />
      );
    } else if (isTransactionUnconfirmed(transactionInfo)) {
      return (
        <IconExclamationCircle
          stroke={2}
          style={{ width: '1.25rem', height: '1.25rem' }}
          color="var(--mantine-color-yellow-filled)"
        />
      );
    }

    return <Loader size="xs" color="var(--mantine-color-dark-2)" />;
  };

  /**
   * asynchronously confirm transaction result for each signature and update state when resolved
   */
  const confirmTransaction = async (transactionInfos: Array<TransactionInfo<T>>, id: string) => {
    transactionInfos.forEach((transactionInfo) => {
      const timeoutValue = randomInRange(1_000, 10_000);
      console.debug('timeoutValue: ', timeoutValue);
      const signature = transactionInfo.signature;

      const controller = new AbortController();
      const signal = controller.signal;

      const confirmTransactionPromise = new Promise(
        (resolve: (value: { signature: string; error: boolean }) => void) => {
          const transactionHasError = Math.random() > 0.65;
          setTimeout(() => {
            resolve({
              signature,
              error: transactionHasError,
            });
          }, timeoutValue);
        },
      );

      const timeoutPromise = new Promise((_, reject) => {
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 7_500);

        signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new Error('Transaction confirmation aborted'));
        });
      });

      Promise.race([confirmTransactionPromise, timeoutPromise])
        .then((result) => {
          if ((result as any).signature) {
            const signature = (result as any).signature;
            const transactionHasError = (result as any).error as boolean;

            updateSingleTransactionInfo(signature, id, () => ({
              result: {
                err: transactionHasError ? {} : null,
              },
            }));

            setSuccessfulSignatureCount((state) => {
              const current = state[id] ?? 0;
              return {
                ...state,
                [id]: transactionHasError ? current : current + 1,
              };
            });
          }
        })
        .catch((err) => {
          console.error(
            `an error occurred resolving transaction for signature [${transactionInfo.signature}]`,
            err,
          );

          updateSingleTransactionInfo(signature, id, () => ({
            status: TransactionStatus.TIMED_OUT,
          }));
        });
    });
  };

  useEffect(() => {
    asyncClearStateForNotificationId();

    return () => {
      setIdsToClear([]);
    };
  }, [idsToClear]);

  /**
   * render a notification update when a transaction result is received
   */
  useEffect(() => {
    const notificationIds = Object.keys(idToTransactionInfos);
    if (notificationIds.length === 0) return;

    notificationIds.forEach((id) => {
      const transactionInfos = idToTransactionInfos[id];
      notifications.update({
        id,
        title: <Text fw="bold">{generateTitle(transactionInfos, id)}</Text>,
        message: generateNotficationBody(transactionInfos),
      });
    });
  }, [idToTransactionInfos]);

  const triggerNotifications =
    /**
     * Sends transactions.
     * @param txs A sequence of sets of transactions. Sets are executed simultaneously.
     * @returns A sequence of set of tx signatures.
     */
    (txs: SingleOrArray<T | TransactionWithMetadata<T>>) => {
      const sequence = txs instanceof Array ? txs : [txs];
      if (sequence.length === 0 || (sequence[0] instanceof Array && sequence[0].length === 0)) {
        throw new Error('No transactions passed');
      }

      const transactionInfosToLoad = sequence.reduce((acc, el, i) => {
        const signature = generateSignature(25);
        acc[signature] = {
          signature: signature,
          transaction: isTransactionWithMeta(el)
            ? el
            : {
                tx: el,
                canonicalDescriptor: undefined,
              },
        };

        return acc;
      }, {} as Record<string, TransactionInfo<T>>);

      const transactionInfos = Object.values(transactionInfosToLoad);
      const id = notifications.show({
        title: <Text fw="bold">{generateTitle(transactionInfos)}</Text>,
        message: generateNotficationBody(transactionInfos),
        ...generateDefaultNotificationOptions(),
      });

      setIdToTransactionInfos((state) => ({
        ...state,
        [id]: transactionInfos,
      }));
      confirmTransaction(transactionInfos, id);
    };

  return { triggerNotifications };
};
