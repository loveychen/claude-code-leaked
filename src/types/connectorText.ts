// Stub for connectorText types
export interface ConnectorTextBlock {
  type: 'connector_text';
  content: string;
}

export function isConnectorTextBlock(block: unknown): block is ConnectorTextBlock {
  return (
    typeof block === 'object' &&
    block !== null &&
    'type' in block &&
    (block as ConnectorTextBlock).type === 'connector_text'
  );
}
