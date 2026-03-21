"use client";

import { RainbowKitProvider, getDefaultConfig, darkTheme } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  phantomWallet,
  braveWallet,
  rainbowWallet,
  walletConnectWallet,
  injectedWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { WagmiProvider } from "wagmi";
import { base } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@rainbow-me/rainbowkit/styles.css";

const PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "b56e18d47c72ab683b10814fe9495694";

const config = getDefaultConfig({
  appName: "AEP Protocol",
  appDescription: "The settlement layer for AI agents — register, trade, and earn on Base Mainnet",
  appUrl: "https://aepprotocol.xyz",
  projectId: PROJECT_ID,
  chains: [base],
  ssr: true,
  wallets: [
    {
      groupName: "Installed",
      wallets: [braveWallet, metaMaskWallet, phantomWallet, injectedWallet],
    },
    {
      groupName: "Other",
      wallets: [rainbowWallet, walletConnectWallet],
    },
  ],
});

const queryClient = new QueryClient();

export function Web3Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#22c55e",
            accentColorForeground: "#000",
            borderRadius: "medium",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
