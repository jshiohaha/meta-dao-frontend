import { useCallback, useMemo, useState } from 'react';
import {
  Button,
  Fieldset,
  Grid,
  GridCol,
  Group,
  Loader,
  Progress,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import Link from 'next/link';
import { IconExternalLink } from '@tabler/icons-react';
import numeral from 'numeral';
import { useProposal } from '@/hooks/useProposal';
import { useTokens } from '@/hooks/useTokens';
import { useTokenAmount } from '@/hooks/useTokenAmount';
import { TWAPOracle, LeafNode } from '@/lib/types';
import { NUMERAL_FORMAT } from '@/lib/constants';
import { ProposalOrdersCard } from './ProposalOrdersCard';
import { OrderBook } from "@lab49/react-order-book";

export function ProposalDetailCard({ proposalNumber }: { proposalNumber: number }) {
  const { proposal, markets, orders, mintTokens, placeOrder, loading } = useProposal({
    fromNumber: proposalNumber,
  });
  const [mintBaseAmount, setMintBaseAmount] = useState<number>();
  const [mintQuoteAmount, setMintQuoteAmount] = useState<number>();
  const { amount: baseAmount } = useTokenAmount(markets?.baseVault.underlyingTokenMint);
  const { amount: basePassAmount } = useTokenAmount(
    markets?.baseVault.conditionalOnFinalizeTokenMint,
  );
  const { amount: baseFailAmount } = useTokenAmount(
    markets?.baseVault.conditionalOnRevertTokenMint,
  );
  const { amount: quoteAmount } = useTokenAmount(markets?.quoteVault.underlyingTokenMint);
  const { amount: quotePassAmount } = useTokenAmount(
    markets?.quoteVault.conditionalOnFinalizeTokenMint,
  );
  const { amount: quoteFailAmount } = useTokenAmount(
    markets?.quoteVault.conditionalOnRevertTokenMint,
  );
  const { tokens } = useTokens();
  const [passAmount, setPassAmount] = useState<number>(0);
  const [failAmount, setFailAmount] = useState<number>(0);
  const [passPrice, setPassPrice] = useState<number>(0);
  const [failPrice, setFailPrice] = useState<number>(0);
  const [orderType, setOrderType] = useState<string>('Limit');

  const orderbook = useMemo(() => {
    if (!markets) return;

    const getSide = (side: LeafNode[], bids?: boolean) => {
      if (side.length === 0) {
        return null;
      }
      const parsed = side.map((e) => ({
        price: e.key.shrn(64).toNumber(),
        size: e.quantity.toNumber(),
      })).sort((a, b) => a.price - b.price);

      const sorted = bids ? parsed.sort((a, b) => b.price - a.price) : parsed.sort((a, b) => a.price - b.price);

      let deduped = new Map();
      sorted.map(order => {
        if (deduped.get(order.price) == undefined) {
          deduped.set(order.price, order.size);
        } else {
          deduped.set(order.price, deduped.get(order.price) + order.size);
        }
      });

      const total = parsed.reduce((a, b) => ({
        price: a.price + b.price,
        size: a.size + b.size,
      }));
      return { parsed: bids ? parsed : parsed, total, deduped };
    };

    return {
      pass: { asks: getSide(markets.passAsks), bids: getSide(markets.passBids, true) },
      fail: { asks: getSide(markets.failAsks), bids: getSide(markets.failBids, true) },
    };
  }, [markets]);

  const handleMint = useCallback(
    async (fromBase?: boolean) => {
      if ((!mintBaseAmount && fromBase) || (!mintQuoteAmount && !fromBase)) return;

      if (fromBase) {
        await mintTokens(mintBaseAmount!, true);
      } else {
        await mintTokens(mintQuoteAmount!, false);
      }
    },
    [mintTokens, mintBaseAmount, mintQuoteAmount],
  );

  const calculateTWAP = (twapOracle: TWAPOracle) => {
    const slotsPassed = twapOracle.lastUpdatedSlot.sub(twapOracle.initialSlot);
    const twapValue = twapOracle.observationAggregator.div(slotsPassed);
    return numeral(twapValue.toString()).divide(10_000).format('0.0000a');
  };

  const passTwap = markets ? calculateTWAP(markets.passTwap.twapOracle) : null;
  const failTwap = markets ? calculateTWAP(markets.failTwap.twapOracle) : null;

  return !proposal || !markets ? (
    <Group justify="center">
      <Loader />
    </Group>
  ) : (
    <Stack gap="0">
      <Text fw="bolder" size="xl">
        Proposal #{proposal.account.number + 1}
      </Text>
      <Link href={proposal.account.descriptionUrl}>
        <Group gap="sm">
          <Text>Go to description</Text>
          <IconExternalLink />
        </Group>
      </Link>
      <Stack>
        <Group gap="md" justify="space-around" p="sm">
          <Fieldset>
            <Stack gap="sm">
              <Text fw="bold" size="lg">
                Pass market
              </Text>
              <Stack>
                <Group>
                  <Text>
                    Best Bid:{' '}
                    {numeral(markets.passPrice.bid.toString())
                      // .divide(10 ** (tokens?.usdc?.decimals || 0))
                      .format('0.00a')}
                  </Text>
                  <Text>
                    Best Ask:{' '}
                    {numeral(markets.passPrice.ask.toString())
                      // .divide(10 ** (tokens?.meta?.decimals || 0))
                      .format('0.00a')}
                  </Text>
                </Group>
                <Group>
                  <Text>TWAP: {passTwap}</Text>
                </Group>
              </Stack>
              <SegmentedControl
                data={['Limit', 'Market']}
                value={orderType}
                onChange={(e) => setOrderType(e)}
                fullWidth
              />
              <TextInput
                type="number"
                label="Bid price"
                placeholder="Enter price..."
                onChange={(e) => setPassPrice(Number(e.target.value))}
              />
              <TextInput
                type="number"
                label="Bid amount"
                placeholder="Enter amount..."
                onChange={(e) => setPassAmount(Number(e.target.value))}
              />
              <Grid>
                <GridCol span={6}>
                  <Button
                    color="green"
                    onClick={() =>
                      placeOrder(passAmount, passPrice, orderType === 'Limit', false, true)
                    }
                    loading={loading}
                    disabled={!passAmount || !passPrice}
                    fullWidth
                  >
                    Bid
                  </Button>
                </GridCol>
                <GridCol span={6}>
                  <Button
                    color="red"
                    onClick={() =>
                      placeOrder(passAmount, passPrice, orderType === 'Limit', true, true)
                    }
                    loading={loading}
                    disabled={!passAmount || !passPrice}
                    fullWidth
                  >
                    Ask
                  </Button>
                </GridCol>
              </Grid>
              <Stack gap="0">
                <Text fw="lighter" size="sm" c="green">
                  Balance: {basePassAmount?.uiAmountString || 0} $p{tokens?.meta?.symbol}
                </Text>
                <Text fw="lighter" size="sm" c="green">
                  Balance: {quotePassAmount?.uiAmountString || 0} $p{tokens?.usdc?.symbol}
                </Text>
              </Stack>
            </Stack>
          </Fieldset>
          <Fieldset>
            <Stack gap="sm">
              <Text fw="bold" size="lg">
                Fail market
              </Text>
              <Stack>
                <Group>
                  <Text>
                    Best Bid:{' '}
                    {numeral(markets.failPrice.bid.toString())
                      // .divide(10 ** (tokens?.usdc?.decimals || 0))
                      .format('0.00a')}
                  </Text>
                  <Text>
                    Best Ask:{' '}
                    {numeral(markets.failPrice.ask.toString())
                      // .divide(10 ** (tokens?.meta?.decimals || 0))
                      .format('0.00a')}
                  </Text>
                </Group>
                <Group>
                  <Text>TWAP: {failTwap}</Text>
                </Group>
              </Stack>
              <SegmentedControl
                data={['Limit', 'Market']}
                value={orderType}
                onChange={(e) => setOrderType(e)}
                fullWidth
              />
              <TextInput
                label="Bid price"
                placeholder="Enter price..."
                type="number"
                onChange={(e) => setFailPrice(Number(e.target.value))}
              />
              <TextInput
                label="Bid amount"
                placeholder="Enter amount..."
                type="number"
                onChange={(e) => setFailAmount(Number(e.target.value))}
              />
              <Grid>
                <GridCol span={6}>
                  <Button
                    fullWidth
                    color="green"
                    onClick={() =>
                      placeOrder(failAmount, failPrice, orderType === 'Limit', false, false)
                    }
                    loading={loading}
                    disabled={!failAmount || !failPrice}
                  >
                    Bid
                  </Button>
                </GridCol>
                <GridCol span={6}>
                  <Button
                    fullWidth
                    color="red"
                    onClick={() =>
                      placeOrder(failAmount, failPrice, orderType === 'Limit', true, false)
                    }
                    loading={loading}
                    disabled={!failAmount || !failPrice}
                  >
                    Ask
                  </Button>
                </GridCol>
              </Grid>
              <Stack gap="0">
                <Text fw="lighter" size="sm" c="red">
                  Balance: {baseFailAmount?.uiAmountString || 0} $f{tokens?.meta?.symbol}
                </Text>
                <Text fw="lighter" size="sm" c="red">
                  Balance: {quoteFailAmount?.uiAmountString || 0} $f{tokens?.usdc?.symbol}
                </Text>
              </Stack>
            </Stack>
          </Fieldset>
        </Group>
        <Group justify="space-around">
          <Fieldset legend={`Mint conditional $${tokens?.meta?.symbol}`}>
            <TextInput
              label="Amount"
              description={`Balance: ${baseAmount?.uiAmountString || 0} $${tokens?.meta?.symbol}`}
              placeholder="Amount to mint"
              type="number"
              onChange={(e) => setMintBaseAmount(Number(e.target.value))}
            />
            <Text fw="lighter" size="sm" c="green">
              Balance: {basePassAmount?.uiAmountString || 0} $p{tokens?.meta?.symbol}
            </Text>
            <Text fw="lighter" size="sm" c="red">
              Balance: {baseFailAmount?.uiAmountString || 0} $f{tokens?.meta?.symbol}
            </Text>
            <Button
              mt="md"
              disabled={(mintBaseAmount || 0) <= 0}
              onClick={() => handleMint(true)}
              loading={loading}
              fullWidth
            >
              Mint
            </Button>
          </Fieldset>
          <Fieldset legend={`Mint conditional $${tokens?.usdc?.symbol}`}>
            <TextInput
              label="Amount"
              description={`Balance: ${quoteAmount?.uiAmountString || 0} $${tokens?.usdc?.symbol}`}
              placeholder="Amount to mint"
              type="number"
              onChange={(e) => setMintQuoteAmount(Number(e.target.value))}
            />
            <Text fw="lighter" size="sm" c="green">
              Balance: {quotePassAmount?.uiAmountString || 0} $p{tokens?.usdc?.symbol}
            </Text>
            <Text fw="lighter" size="sm" c="red">
              Balance: {quoteFailAmount?.uiAmountString || 0} $f{tokens?.usdc?.symbol}
            </Text>
            <Button
              mt="md"
              disabled={(mintQuoteAmount || 0) <= 0}
              loading={loading}
              onClick={() => handleMint(false)}
              fullWidth
            >
              Mint
            </Button>
          </Fieldset>
        </Group>
        {orderbook ? (
          <Group justify="space-around" align="start">
            <Stack p={0} m={0} gap={0}>
              <Text fw="bolder" size="lg">
                Pass market orderbook
              </Text>
              <style
        
        dangerouslySetInnerHTML={{
          __html: `
            .MakeItNice {
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
              font-size: 13px;
              font-variant-numeric: tabular-nums;
              // display: inline-block;
              // background-color: #070F15;
              // color: rgba(255, 255, 255, 0.6);
              padding: 50px 0;
            }

            // .MakeItNice__side-header {
            //   margin: 0 0 5px 0;
            //   font-weight: 700;
            //   text-align: right;
            // }

            .MakeItNice__list {
              // list-style-type: none;
              padding: 0;
              margin: 0;
            }

            .MakeItNice__list-item {
              cursor: pointer;
              padding: 2px 50px 2px 20px;
              display: flex;
            }

            .MakeItNice__list-item:hover {
              background: rgb(240, 240, 240);
            }

            .MakeItNice__price {
              flex: 0 0 70px;
              color: var(--row-color);
              text-align: right;
              display: inline-block;
              margin-right: 15px;
            }

            .MakeItNice__size {
              flex: 0 0 70px;
            }

            .MakeItNice__spread {
              border-width: 1px 0;
              border-style: solid;
              border-color: rgba(255, 255, 255, 0.2);
              padding: 5px 20px;
              text-align: center;
              display: flex;
            }

            .MakeItNice__spread-header {
              margin: 0 15px 0 0;
              flex: 0 0 70px;
              text-align: right;
            }

            .MakeItNice__spread-value {
              width: 28px;
              overflow: hidden;
            }
          `,
        }}
      />

      <OrderBook
        // book={{ bids: book.bids, asks: book.asks }}
        book={{
          bids: Array.from(orderbook.pass.bids?.deduped.entries()).map(bid => [(bid[0] / 10_000).toFixed(2), bid[1]]),
          asks: Array.from(orderbook.pass.asks?.deduped.entries()).map(ask => [(ask[0] / 10_000).toFixed(2), ask[1]]),
        }}
        fullOpacity
        interpolateColor={(color) => color}
        listLength={7}
        stylePrefix="MakeItNice"
      />
              {/* <OrderBook book={{
                bids: orderbook.pass.bids?.parsed.map(bid => [bid.price, bid.size]),
                asks: [["2.0404", "40"]],
              }} /> */}
              
              <Group gap="0">
                {orderbook.pass.asks?.parsed.map((ask, index) => (
                  <Grid key={index} w="100%" gutter={0} mih="md">
                    <Grid.Col span={3} />
                    <Grid.Col span={1.5} h="sm" p="0">
                      <Text size="0.6rem">{numeral(ask.price).format(NUMERAL_FORMAT)}</Text>
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <Progress
                        key={ask.price + ask.size}
                        value={
                          orderbook.pass.asks
                            ? Math.ceil((ask.price / orderbook.pass.asks.total.price) * 100)
                            : 0
                        }
                        color="red"
                        w="100%"
                      />
                    </Grid.Col>
                  </Grid>
                ))}
                {orderbook.pass.bids?.parsed.map((bid, index) => (
                  <Grid key={index} w="100%" gutter={0} mih="md">
                    <Grid.Col span={3}>
                      <Progress
                        key={bid.price + bid.size}
                        value={
                          orderbook.pass.bids
                            ? Math.ceil((bid.price / orderbook.pass.bids.total.price) * 100)
                            : 0
                        }
                        color="green"
                        w="100%"
                      />
                    </Grid.Col>
                    <Grid.Col span={1.5} h="sm" p="0" ml={2}>
                      <Text size="0.6rem">{numeral(bid.price).format(NUMERAL_FORMAT)}</Text>
                    </Grid.Col>
                    <Grid.Col span={3} h="sm" p="0" />
                  </Grid>
                ))}
              </Group>
            </Stack>
            <Stack p={0} m={0} gap={0}>
              <Text fw="bolder" size="lg">
                Fail market orderbook
              </Text>
              <Group gap="0">
                {orderbook.fail.asks?.parsed.map((ask, index) => (
                  <Grid key={index} w="100%" gutter={0} mih="md">
                    <Grid.Col span={3} h="sm" p="0" />
                    <Grid.Col span={1.5} h="sm" p="0">
                      <Text size="0.6rem">{numeral(ask.price).format(NUMERAL_FORMAT)}</Text>
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <Progress
                        key={ask.price + ask.size}
                        value={
                          orderbook.fail.asks
                            ? Math.ceil((ask.price / orderbook.fail.asks.total.price) * 100)
                            : 0
                        }
                        color="red"
                        w="100%"
                      />
                    </Grid.Col>
                  </Grid>
                ))}
                {orderbook.fail.bids?.parsed.map((bid, index) => (
                  <Grid key={index} w="100%" gutter={0} mih="md">
                    <Grid.Col span={3}>
                      <Progress
                        key={bid.price + bid.size}
                        value={
                          orderbook.fail.bids
                            ? Math.ceil((bid.price / orderbook.fail.bids.total.price) * 100)
                            : 0
                        }
                        color="green"
                        w="100%"
                      />
                    </Grid.Col>
                    <Grid.Col span={1.5} h="sm" p="0">
                      <Text size="0.6rem">{numeral(bid.price).format(NUMERAL_FORMAT)}</Text>
                    </Grid.Col>
                    <Grid.Col span={3} h="sm" p="0" />
                  </Grid>
                ))}
              </Group>
            </Stack>
          </Group>
        ) : null}
        {proposal && orders ? (
          <ProposalOrdersCard
            markets={markets}
            proposal={proposal}
            orders={orders}
          />
        ) : null}
      </Stack>
    </Stack>
  );
}
