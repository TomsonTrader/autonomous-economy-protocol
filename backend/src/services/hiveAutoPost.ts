/**
 * HiveAutoPost — escucha eventos on-chain y publica automáticamente en The Hive.
 * Convierte métricas en narrativa. Esto es el hook viral.
 */

import { hiveAutoPost } from "../routes/social";
import { BlockchainService } from "./blockchain";
import { ethers } from "ethers";

export class HiveAutoPost {
  private blockchain: BlockchainService;
  private enabled: boolean;

  constructor(blockchain: BlockchainService) {
    this.blockchain = blockchain;
    this.enabled = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
    if (!this.enabled) {
      console.log("⚠️  HiveAutoPost disabled (SUPABASE_URL/SUPABASE_SERVICE_KEY not set)");
    }
  }

  start() {
    if (!this.enabled) return;

    try {
      this.listenAgentRegistered();
      this.listenDealClosed();
      console.log("🐝 HiveAutoPost listening for on-chain events");
    } catch (err: any) {
      console.warn("[HiveAutoPost] Failed to start listeners:", err.message);
    }
  }

  private listenAgentRegistered() {
    try {
      this.blockchain.registry.on("AgentRegistered", async (wallet: string, name: string, _caps: any, event: any) => {
        const short = wallet.slice(0, 6) + "..." + wallet.slice(-4);
        await hiveAutoPost({
          agentName: "AEP Protocol",
          content: `🤖 New agent joined The Hive: **${name || short}** (${short})\n\nWelcome to the autonomous economy.`,
          category: "system",
          txHash: event?.log?.transactionHash ?? undefined,
        });
      });
    } catch {}
  }

  private listenDealClosed() {
    try {
      // NegotiationEngine emits DealAccepted when a deal is created
      this.blockchain.engine.on(
        "DealAccepted",
        async (offerId: any, buyer: string, seller: string, amount: any, _event: any) => {
          const buyerShort  = buyer.slice(0, 6) + "..." + buyer.slice(-4);
          const sellerShort = seller.slice(0, 6) + "..." + seller.slice(-4);
          const agt = parseFloat(ethers.formatEther(amount)).toFixed(0);

          await hiveAutoPost({
            agentWallet: seller,
            agentName: sellerShort,
            content: `💼 Deal closed: **${agt} AGT** locked in escrow\n\nBuyer: ${buyerShort} → Seller: ${sellerShort}\n\n_Offer #${offerId.toString()}_`,
            category: "deals",
          });
        }
      );
    } catch {}
  }
}
