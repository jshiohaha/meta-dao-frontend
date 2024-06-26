'use client';

import {
  AppShell,
  Button,
  Burger,
  Card,
  Flex,
  Group,
  Menu,
  NativeSelect,
  NumberInput,
  Stack,
  Switch,
  TextInput,
  Title,
  rem,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { useDisclosure, useFavicon, useMediaQuery } from '@mantine/hooks';
import '@mantine/notifications/styles.css';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import numeral from 'numeral';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import {
  IconBooks,
  IconBrandDiscord,
  IconBrandGithub,
  IconBrandTwitter,
  IconSun,
  IconMoonStars,
  IconPlugConnected,
} from '@tabler/icons-react';
import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';
import { Networks, useNetworkConfiguration } from '../../hooks/useNetworkConfiguration';
import { shortKey } from '@/lib/utils';
import icon from '@/public/meta.png';
import _favicon from '@/public/favicon.ico';
import { Explorers, useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';
import classes from '../../app/globals.module.css';
import { usePriorityFee } from '../../hooks/usePriorityFee';
import { NUMERAL_FORMAT } from '../../lib/constants';
import { NavigationLinks } from './NavigationLinks';
import { DialectNotificationComponent } from '@/components/Plugins/DialectNotification';
import { TokenPrice } from './TokenPrice';

const links = [
  {
    name: 'Github',
    href: 'https://github.com/metaDAOproject/meta-dao-frontend',
    icon: IconBrandGithub,
  },
  { name: 'Docs', href: 'https://docs.themetadao.org/', icon: IconBooks },
  { name: 'Discord', href: 'https://discord.gg/metadao', icon: IconBrandDiscord },
  { name: 'Twitter', href: 'https://twitter.com/MetaDAOProject', icon: IconBrandTwitter },
];

const networks = [
  { label: 'Mainnet', value: Networks.Mainnet.toString() },
  { label: 'Mainnet2', value: Networks.Mainnet2.toString() },
  { label: 'Devnet', value: Networks.Devnet.toString() },
  { label: 'Localnet', value: Networks.Localnet.toString() },
  { label: 'Custom', value: Networks.Custom.toString() },
];

const explorers = [
  { label: 'Solana.fm', value: Explorers.SolanaFM.toString() },
  { label: 'Solscan', value: Explorers.Solscan.toString() },
  { label: 'X-Ray', value: Explorers.Xray.toString() },
  { label: 'Solana Explorer', value: Explorers.Solana.toString() },
];

export type LayoutProps = {
  children: React.ReactNode;
};

export function Layout(props: LayoutProps) {
  const { children } = props;
  const wallet = useWallet();
  const modal = useWalletModal();
  const { network, endpoint, setNetwork, setCustomEndpoint } = useNetworkConfiguration();
  const { explorer, setExplorer } = useExplorerConfiguration();
  const colorScheme = useMantineColorScheme();
  const theme = useMantineTheme();

  const isTiny = useMediaQuery(`(max-width: ${theme.breakpoints.xs})`);
  const logoRef = useRef(null);
  const { priorityFee, setPriorityFee } = usePriorityFee();
  const [solPrice, setSolPrice] = useState<number>();
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(false);

  useFavicon(_favicon.src);
  useEffect(() => {
    if (!wallet.connected && wallet.wallet) wallet.connect();
  }, [wallet]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
        );
        const data = await res.json();

        if (data?.solana?.usd) {
          setSolPrice(data.solana.usd);
        } else {
          setSolPrice(0);
        }
      } catch {
        setSolPrice(0);
      }
    };

    // Call fetchData immediately when component mounts
    fetchData();
  }, []); // Empty dependency array means this effect will only run once

  const feesCost = (((priorityFee / 100000) * 200000) / LAMPORTS_PER_SOL) * (solPrice || 0);

  const ThemeSwitch = () => (
    <Switch
      variant="outline"
      size="md"
      color="red"
      onChange={() => colorScheme.toggleColorScheme()}
      checked={colorScheme.colorScheme === 'light'}
      onLabel={<IconSun style={{ width: rem(16), height: rem(16) }} stroke={2.5} />}
      offLabel={<IconMoonStars style={{ width: rem(16), height: rem(16) }} stroke={2.5} />}
    />
  );

  return (
    <div>
      <AppShell
        header={{ height: 60 }}
        navbar={{ breakpoint: 'md', width: 200, collapsed: { mobile: !mobileOpened, desktop: !desktopOpened } }}
        padding="md"
        footer={{ height: 100, offset: true }}
      >
        <AppShell.Header withBorder>
          <Flex justify="space-between" align="center" p="md" w="100%" h="100%">
            <Group p={0} m={0}>
              <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
              <Burger opened={desktopOpened} onClick={toggleDesktop} visibleFrom="sm" size="sm" />
              <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                <Flex justify="flex-start" align="center" gap="xs">
                  <Image src={icon} alt="App logo" width={36} height={36} ref={logoRef} />
                  <Title order={!isTiny ? 3 : 4}>MetaDAO</Title>
                </Flex>
              </Link>
            </Group>

            <TokenPrice />

            <Group>
              {wallet?.publicKey ? (
                <>
                <DialectNotificationComponent />
                <Menu position="bottom-end">
                  <Menu.Target>
                    <Button variant="secondary"><IconPlugConnected strokeWidth={0.85} /></Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Stack p="md" align="center">
                    <NativeSelect
                      w="100%"
                      label="Network"
                      data={networks}
                      value={network}
                      onChange={(e) => setNetwork(e.target.value as Networks)}
                    />
                      {network === Networks.Custom ? (
                        <TextInput
                          label="RPC URL"
                          placeholder="Your custom RPC URL"
                          onChange={(e) => setCustomEndpoint(e.target.value)}
                          defaultValue={endpoint}
                        />
                      ) : null}
                    </Stack>
                  </Menu.Dropdown>
                </Menu>
                <Menu position="bottom-end">
                  <Menu.Target>
                    <Button variant="secondary">{shortKey(wallet.publicKey)}</Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Stack p="md" align="center">
                      <NativeSelect
                        w="100%"
                        label="Explorer"
                        data={explorers}
                        value={explorer}
                        onChange={(e) => setExplorer(e.target.value as Explorers)}
                      />
                      <NumberInput
                        w="100%"
                        label="Priority fee (µLamports)"
                        description={`Adds up to $${numeral(feesCost).format(
                          NUMERAL_FORMAT,
                        )} per tx`}
                        onChange={(e) => setPriorityFee(Number(e || 0))}
                        defaultValue={priorityFee}
                        hideControls
                      />
                      {isTiny ? <ThemeSwitch /> : null}
                      <Button fullWidth onClick={() => wallet.disconnect()}>
                        Disconnect
                      </Button>
                    </Stack>
                  </Menu.Dropdown>
                </Menu>
                </>) : (
                <Button
                  variant="outline"
                  onClick={() => modal.setVisible(true)}
                  loading={modal.visible || wallet.connecting}
                >
                  Connect wallet
                </Button>
              )}
              {!isTiny ? <ThemeSwitch /> : null}
            </Group>
          </Flex>
        </AppShell.Header>
        <AppShell.Navbar p="md">
          <NavigationLinks />
        </AppShell.Navbar>
        <AppShell.Main>{children}</AppShell.Main>
        <AppShell.Footer>
          <Card withBorder style={{ borderRadius: '0px', borderLeft: '0px', borderRight: '0px' }}>
            <Group justify="space-between" p="md">
              <Title order={4}>MetaDAO</Title>
              <Group justify="center" p="xs">
                {links.map((link, i) => (
                  <Link
                    key={`link-${i}`}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'inherit' }}
                  >
                    <link.icon strokeWidth={1.3} className={classes.redHover} />
                  </Link>
                ))}
              </Group>
            </Group>
          </Card>
        </AppShell.Footer>
      </AppShell>

    </div>
  );
}
