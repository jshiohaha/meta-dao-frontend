'use client';

import { Layout } from '@/components/Layout/Layout';
import { Container, Stack } from '@mantine/core';
import { Transaction } from '@solana/web3.js';

import { useDummyTransactionSender } from '@/hooks/useDummyTransactionSender';

const randomInRange = (start: number, end: number) =>
  Math.floor(Math.random() * (end - start + 1) + start);

const srcArr = [
  { tx: new Transaction(), canonicalDescriptor: 'Close Open Order' },
  { tx: new Transaction(), canonicalDescriptor: 'Place Order' },
  { tx: new Transaction(), canonicalDescriptor: 'Merge Tokens' },
  { tx: new Transaction(), canonicalDescriptor: undefined },
  new Transaction(),
];

const pickNRandomElements = (arr: Array<any>) => {
  const shuffledArray = [...arr];
  const result = [];

  for (let i = shuffledArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
  }

  const n = randomInRange(1, srcArr.length - 1);

  for (let i = 0; i < n; i++) {
    result.push(shuffledArray[i]);
  }

  return result;
};

export default function ProposalList() {
  const { triggerNotifications } = useDummyTransactionSender();

  return (
    <Layout>
      <Container p="0">
        <Stack>
          <button onClick={() => triggerNotifications(pickNRandomElements(srcArr))}>
            Trigger Notifications
          </button>
        </Stack>
      </Container>
    </Layout>
  );
}
