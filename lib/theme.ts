export const THEMES = {
  dark: {
    // Core
    bg: "#000",
    pageBg: "#0D0D0D",
    headerBg: "#000",
    headerBorder: "#151515",
    headerText: "#fff",

    // Chat bubbles
    bubbleUser: "#1A2E0A",
    bubbleUserText: "#D4E8BC",
    bubbleBot: "#161616",
    bubbleBotText: "#C8C8C8",

    // Input
    inputBg: "#111",
    inputBorder: "#1C1C1C",
    inputText: "#fff",
    inputPlaceholder: "#333",

    // Send button
    sendBg: "#1A1A1A",
    sendBgActive: "#A8FF3E",
    sendText: "#333",
    sendTextActive: "#000",

    // Widgets / cards
    widgetBg: "#161616",
    widgetBorder: "#222",
    widgetText: "#ccc",
    widgetIconBg: "#1A2E0A",

    // Text
    textPrimary: "#fff",
    textSecondary: "#aaa",
    textTertiary: "#888",
    subText: "#666",
    textMuted: "#555",
    textFaint: "#444",

    // Accent
    accent: "#A8FF3E",
    accentDark: "#1A2E0A",
    accentBorder: "#2a5a2a",

    // Pinned
    pinnedBg: "#1A2E0A",
    pinnedBorder: "#2a5a2a",
    pinnedText: "#D4E8BC",

    // Reply
    replyBg: "#161616",

    // Context menu
    contextMenuBg: "#1E1E1E",
    contextMenuBorder: "#333",
    contextMenuText: "#fff",
    contextMenuSubText: "#888",

    // Misc
    dotBg: "#555",
    typingBg: "#161616",
    loadingBg: "#000",

    // Cards / Dashboard
    cardBg: "#111",
    cardBorder: "#1C1C1C",
    progressBarBg: "#1A1A1A",
    separator: "#1A1A1A",

    // Sidebar
    sidebarBg: "#0D0D0D",
    sidebarItemActiveBg: "#1A2E0A",
    sidebarButtonBg: "#141414",
    sidebarButtonPressBg: "#1A1A1A",

    // Modal
    modalBg: "#1A1A1A",
    modalBorder: "#2a2a2a",
    modalOptionBg: "#222",
    modalOptionPressBg: "#252525",

    // Danger
    danger: "#E57373",
    dangerBg: "#2a1515",
  },
  light: {
    // Core
    bg: "#F5F5F5",
    pageBg: "#F5F5F5",
    headerBg: "#FFFFFF",
    headerBorder: "#E0E0E0",
    headerText: "#111",

    // Chat bubbles
    bubbleUser: "#DCF8C6",
    bubbleUserText: "#1A1A1A",
    bubbleBot: "#FFFFFF",
    bubbleBotText: "#333",

    // Input
    inputBg: "#FFFFFF",
    inputBorder: "#E0E0E0",
    inputText: "#111",
    inputPlaceholder: "#999",

    // Send button
    sendBg: "#E8E8E8",
    sendBgActive: "#A8FF3E",
    sendText: "#999",
    sendTextActive: "#000",

    // Widgets / cards
    widgetBg: "#FFFFFF",
    widgetBorder: "#E8E8E8",
    widgetText: "#333",
    widgetIconBg: "#E8F5D6",

    // Text
    textPrimary: "#111",
    textSecondary: "#555",
    textTertiary: "#777",
    subText: "#888",
    textMuted: "#999",
    textFaint: "#BBB",

    // Accent
    accent: "#5BAA22",
    accentDark: "#E8F5D6",
    accentBorder: "#C5E1A5",

    // Pinned
    pinnedBg: "#E8F5D6",
    pinnedBorder: "#C5E1A5",
    pinnedText: "#333",

    // Reply
    replyBg: "#EEEEEE",

    // Context menu
    contextMenuBg: "#FFFFFF",
    contextMenuBorder: "#E0E0E0",
    contextMenuText: "#111",
    contextMenuSubText: "#888",

    // Misc
    dotBg: "#BBB",
    typingBg: "#FFFFFF",
    loadingBg: "#F5F5F5",

    // Cards / Dashboard
    cardBg: "#FFFFFF",
    cardBorder: "#E8E8E8",
    progressBarBg: "#E8E8E8",
    separator: "#E8E8E8",

    // Sidebar
    sidebarBg: "#F8F8F8",
    sidebarItemActiveBg: "#E8F5D6",
    sidebarButtonBg: "#F0F0F0",
    sidebarButtonPressBg: "#E8E8E8",

    // Modal
    modalBg: "#FFFFFF",
    modalBorder: "#E0E0E0",
    modalOptionBg: "#F5F5F5",
    modalOptionPressBg: "#EEEEEE",

    // Danger
    danger: "#D32F2F",
    dangerBg: "#FFEBEE",
  },
};

export type ThemeColors = typeof THEMES.dark;
