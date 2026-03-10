import { ICredentialType, INodeProperties } from "n8n-workflow";

export class AepApi implements ICredentialType {
  name = "aepApi";
  displayName = "AEP API";
  documentationUrl = "https://aepprotocol.xyz";
  properties: INodeProperties[] = [
    {
      displayName: "API Base URL",
      name: "apiUrl",
      type: "string",
      default: "https://autonomous-economy-protocol-production.up.railway.app",
      placeholder: "https://autonomous-economy-protocol-production.up.railway.app",
      description: "AEP backend URL. Use default for Base Mainnet.",
    },
    {
      displayName: "Agent Private Key (optional)",
      name: "privateKey",
      type: "string",
      typeOptions: { password: true },
      default: "",
      description: "Required only for write operations (register, publish, propose). Leave blank for read-only use.",
    },
  ];
}
