export type BridgeAction =
    | "tabs.list"
    | "tabs.open"
    | "tabs.close"
    | "tabs.navigate"
    | "tabs.activate"
    | "dom.getHtml"
    | "dom.getText"
    | "dom.querySelector"
    | "interaction.click"
    | "interaction.hover"
    | "interaction.type"
    | "interaction.scroll"
    | "interaction.pressKey"
    | "capture.screenshot"
    | "capture.computedStyles"
    | "execution.executeJs";

export interface BridgeRequest {
    id: string;
    action: BridgeAction;
    params: Record<string, unknown>;
}

export interface BridgeResponse {
    id: string;
    success: boolean;
    data?: unknown;
    error?: string;
}
