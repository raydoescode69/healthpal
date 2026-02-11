import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
} from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import { sendMessage, generateWelcome } from "../../lib/chatEngine";
import { QUICK_ACTIONS } from "../../lib/types";
import type { DietPlanData, ConversationItem } from "../../lib/types";
import DietPlanCardComponent from "../../components/DietPlanCard";
import ChatSidebar from "../../components/ChatSidebar";

// ── Display types ──────────────────────────────────────────────
interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface DietCardItem {
  id: string;
  type: "diet_card";
  plan: DietPlanData;
  created_at: string;
}

type FlatListItem = DisplayMessage | DietCardItem;

function isDietCard(item: FlatListItem): item is DietCardItem {
  return "type" in item && item.type === "diet_card";
}

// ── Typing dots ─────────────────────────────────────────────────
function Dot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.3, { duration: 400 })
        ),
        -1,
        true
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={style}
      className="w-[6px] h-[6px] rounded-full bg-[#555] mx-[2px]"
    />
  );
}

function TypingIndicator() {
  return (
    <View className="px-5 mb-3 items-start">
      <View className="bg-[#161616] rounded-2xl rounded-tl px-4 py-3 flex-row items-center">
        <Dot delay={0} />
        <Dot delay={200} />
        <Dot delay={400} />
      </View>
    </View>
  );
}

// ── Typewriter reveal ───────────────────────────────────────────
function useTypewriter(fullText: string, speed: number = 18) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!fullText) return;
    setDisplayed("");
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(fullText.slice(0, i));
      if (i >= fullText.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [fullText]);

  return { displayed, done };
}

// ── Message bubble ──────────────────────────────────────────────
function MessageBubble({ item }: { item: DisplayMessage }) {
  const isUser = item.role === "user";

  return (
    <View className={`px-5 mb-2.5 ${isUser ? "items-end" : "items-start"}`}>
      <View
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-[#1A2E0A] rounded-br-sm"
            : "bg-[#161616] rounded-bl-sm"
        }`}
      >
        <Text
          className={`text-[15px] leading-[22px] font-dm ${
            isUser ? "text-[#D4E8BC]" : "text-[#C8C8C8]"
          }`}
        >
          {item.content}
        </Text>
      </View>
    </View>
  );
}

// ── Typewriter bot bubble ───────────────────────────────────────
function BotTypingBubble({
  fullText,
  onDone,
}: {
  fullText: string;
  onDone: () => void;
}) {
  const { displayed, done } = useTypewriter(fullText, 14);

  useEffect(() => {
    if (done) onDone();
  }, [done]);

  return (
    <Animated.View entering={FadeIn.duration(200)} className="px-5 mb-2.5 items-start">
      <View className="max-w-[80%] bg-[#161616] rounded-2xl rounded-bl-sm px-4 py-2.5">
        <Text className="text-[15px] leading-[22px] font-dm text-[#C8C8C8]">
          {displayed}
          {!done && <Text className="text-brand-green">{"\u258D"}</Text>}
        </Text>
      </View>
    </Animated.View>
  );
}

// ── Main chat screen ────────────────────────────────────────────
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [listData, setListData] = useState<FlatListItem[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Bubble queue state
  const [currentBubbleText, setCurrentBubbleText] = useState<string | null>(null);
  const bubbleQueueRef = useRef<string[]>([]);
  const pendingDietPlanRef = useRef<DietPlanData | null>(null);
  const isProcessingBubblesRef = useRef(false);

  // Conversation tracking
  const conversationIdRef = useRef<string>(Crypto.randomUUID());
  const conversationCreatedRef = useRef(false);
  const welcomeSent = useRef(false);

  // Diet plan shown flag — persisted per conversation
  const dietPlanShownRef = useRef(false);

  const getDietPlanKey = (convId: string) => `dietPlanShown_${convId}`;

  const markDietPlanShown = async (convId: string) => {
    dietPlanShownRef.current = true;
    try {
      await AsyncStorage.setItem(getDietPlanKey(convId), "true");
    } catch {}
  };

  const loadDietPlanFlag = async (convId: string) => {
    try {
      const val = await AsyncStorage.getItem(getDietPlanKey(convId));
      dietPlanShownRef.current = val === "true";
    } catch {
      dietPlanShownRef.current = false;
    }
  };

  const userId = session?.user?.id || "";

  // Sync listData when messages change
  useEffect(() => {
    setListData([...messages]);
  }, [messages]);

  // ── Load chat history on mount ─────────────────────────────
  useEffect(() => {
    if (!userId) return;
    loadLatestConversation();
  }, [userId]);

  const loadLatestConversation = async () => {
    try {
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, title, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (convs && convs.length > 0) {
        const latestConv = convs[0];
        conversationIdRef.current = latestConv.id;
        conversationCreatedRef.current = true;
        await loadDietPlanFlag(latestConv.id);

        const { data: msgs } = await supabase
          .from("messages")
          .select("*")
          .eq("user_id", userId)
          .eq("conversation_id", latestConv.id)
          .order("created_at", { ascending: true })
          .limit(50);

        if (msgs && msgs.length > 0) {
          setMessages(msgs);
          setLoadingHistory(false);
          return;
        }
      }

      setLoadingHistory(false);
      sendWelcome();
    } catch {
      setLoadingHistory(false);
      sendWelcome();
    }
  };

  // ── Create conversation in DB ──────────────────────────────
  const ensureConversation = async (title: string) => {
    if (conversationCreatedRef.current || !userId) return;
    conversationCreatedRef.current = true;
    try {
      const { error } = await supabase.from("conversations").insert({
        id: conversationIdRef.current,
        user_id: userId,
        title: title.slice(0, 40),
      });
      console.log("[Chat] ensureConversation:", { id: conversationIdRef.current, title: title.slice(0, 40), error: error?.message });
    } catch (e) {
      console.log("[Chat] ensureConversation error:", e);
    }
  };

  // ── Welcome message ────────────────────────────────────────
  const sendWelcome = async () => {
    if (welcomeSent.current || !userId) return;
    welcomeSent.current = true;
    setShowTypingIndicator(true);

    try {
      const welcomeText = await generateWelcome(userId);
      setShowTypingIndicator(false);

      const botMsg: DisplayMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: welcomeText,
        created_at: new Date().toISOString(),
      };

      setMessages([botMsg]);
      setCurrentBubbleText(welcomeText);
      saveMessage("assistant", welcomeText);
    } catch {
      setShowTypingIndicator(false);
      const fallbackMsg: DisplayMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: "yo bhai! kya scene hai? health related kuch bhi puchna ho toh bol \uD83D\uDCAA",
        created_at: new Date().toISOString(),
      };
      setMessages([fallbackMsg]);
    }
  };

  // ── New chat ───────────────────────────────────────────────
  const handleNewChat = () => {
    if (isLoading) return;

    conversationIdRef.current = Crypto.randomUUID();
    conversationCreatedRef.current = false;
    dietPlanShownRef.current = false;

    setMessages([]);
    setListData([]);
    setCurrentBubbleText(null);
    bubbleQueueRef.current = [];
    pendingDietPlanRef.current = null;
    isProcessingBubblesRef.current = false;
    setShowTypingIndicator(false);

    welcomeSent.current = false;
    sendWelcome();
  };

  // ── Load a specific conversation ───────────────────────────
  const handleSelectConversation = async (conv: ConversationItem) => {
    if (isLoading) return;

    conversationIdRef.current = conv.id;
    conversationCreatedRef.current = true;
    await loadDietPlanFlag(conv.id);

    setMessages([]);
    setListData([]);
    setCurrentBubbleText(null);
    bubbleQueueRef.current = [];
    pendingDietPlanRef.current = null;
    isProcessingBubblesRef.current = false;
    setShowTypingIndicator(false);

    try {
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("user_id", userId)
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true })
        .limit(50);

      if (msgs && msgs.length > 0) {
        setMessages(msgs);
      }
    } catch {
      // silent
    }
  };

  // ── Save message to DB ─────────────────────────────────────
  const saveMessage = async (role: "user" | "assistant", content: string) => {
    if (!userId) return;
    try {
      await supabase.from("messages").insert({
        user_id: userId,
        role,
        content,
        conversation_id: conversationIdRef.current,
      });
    } catch {
      // silent
    }
  };

  // ── Scroll helpers ─────────────────────────────────────────
  const scrollToEnd = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 60);
  }, []);

  // ── Handle personalize button ──────────────────────────────
  const handlePersonalize = useCallback(() => {
    handleSend("yes, customize my diet plan");
  }, []);

  // ── Process bubble queue ───────────────────────────────────
  const processBubbleQueue = useCallback(() => {
    if (isProcessingBubblesRef.current) return;
    if (bubbleQueueRef.current.length === 0) {
      // All bubbles done — show diet card if pending
      if (pendingDietPlanRef.current) {
        const plan = pendingDietPlanRef.current;
        pendingDietPlanRef.current = null;
        setListData((prev) => [
          ...prev,
          {
            id: `diet-${Date.now()}`,
            type: "diet_card" as const,
            plan,
            created_at: new Date().toISOString(),
          },
        ]);
        scrollToEnd();
      }
      setIsLoading(false);
      return;
    }

    isProcessingBubblesRef.current = true;
    const nextText = bubbleQueueRef.current.shift()!;

    setShowTypingIndicator(true);
    scrollToEnd();

    setTimeout(() => {
      setShowTypingIndicator(false);

      const botMsg: DisplayMessage = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        content: nextText,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
      saveMessage("assistant", nextText);
      setCurrentBubbleText(nextText);
      scrollToEnd();
    }, 700);
  }, [scrollToEnd]);

  // Called when a typewriter bubble finishes
  const handleBubbleDone = useCallback(() => {
    setCurrentBubbleText(null);
    isProcessingBubblesRef.current = false;

    setTimeout(() => {
      processBubbleQueue();
    }, 200);
  }, [processBubbleQueue]);

  // ── Send message ───────────────────────────────────────────
  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isLoading) return;

    Keyboard.dismiss();

    const userMsg: DisplayMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setShowTypingIndicator(true);
    setCurrentBubbleText(null);
    scrollToEnd();

    // Create conversation on first user message
    ensureConversation(content);
    saveMessage("user", content);

    const messageHistory = messages.slice(-10).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    try {
      const response = await sendMessage(
        userId,
        conversationIdRef.current,
        content,
        messageHistory,
        dietPlanShownRef.current
      );

      setShowTypingIndicator(false);

      if (response.dietPlan) {
        pendingDietPlanRef.current = response.dietPlan;
        markDietPlanShown(conversationIdRef.current);
      }

      bubbleQueueRef.current = [...response.bubbles];
      isProcessingBubblesRef.current = false;
      processBubbleQueue();
    } catch {
      setShowTypingIndicator(false);
      setIsLoading(false);
      const errMsg: DisplayMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "arre yaar connection issue lag raha hai \uD83D\uDE05 internet check karke try again?",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    }
  };

  // ── Loading screen ─────────────────────────────────────────
  if (loadingHistory) {
    return (
      <View className="flex-1 bg-brand-dark items-center justify-center">
        <ActivityIndicator color="#A8FF3E" size="small" />
      </View>
    );
  }

  const lastMsg = messages[messages.length - 1];
  const isLastBubbleTyping =
    currentBubbleText !== null &&
    lastMsg?.role === "assistant" &&
    lastMsg?.content === currentBubbleText;

  return (
    <View className="flex-1 bg-brand-dark">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "android" ? 20 : 0}
      >
        {/* Header */}
        <View
          style={{ paddingTop: insets.top + 6 }}
          className="px-5 pb-3 border-b border-[#151515]"
        >
          <View className="flex-row items-center justify-between">
            {/* Left: hamburger */}
            <Pressable
              onPress={() => setSidebarOpen(true)}
              className="w-9 h-9 rounded-full items-center justify-center active:opacity-60"
            >
              <Text className="text-[18px] text-[#888]">{"\u2630"}</Text>
            </Pressable>

            {/* Center: Pal */}
            <View className="flex-row items-center">
              <Text className="text-[17px] text-white font-sora-semibold">
                Pal {"\uD83C\uDF3F"}
              </Text>
            </View>

            {/* Right spacer to keep title centered */}
            <View className="w-9 h-9" />
          </View>
        </View>

        {/* Messages — tap to dismiss keyboard */}
        <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
          <FlatList
            ref={flatListRef}
            data={listData}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => {
              if (isDietCard(item)) {
                return (
                  <DietPlanCardComponent
                    plan={item.plan}
                    onPersonalize={!item.plan.is_personalized ? handlePersonalize : undefined}
                  />
                );
              }

              if (
                isLastBubbleTyping &&
                index === listData.length - 1 &&
                !isDietCard(item)
              ) {
                return (
                  <BotTypingBubble
                    fullText={currentBubbleText!}
                    onDone={handleBubbleDone}
                  />
                );
              }

              return <MessageBubble item={item as DisplayMessage} />;
            }}
            contentContainerStyle={{
              paddingTop: 16,
              paddingBottom: 8,
              flexGrow: 1,
            }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToEnd}
          />
        </Pressable>

        {/* Typing indicator */}
        {showTypingIndicator && <TypingIndicator />}

        {/* Bottom bar */}
        <View
          style={{ paddingBottom: insets.bottom + 4 }}
          className="border-t border-[#151515] bg-brand-dark"
        >
          {/* Quick chips */}
          <View className="flex-row px-4 pt-2.5 pb-2">
            {QUICK_ACTIONS.map((action) => (
              <Pressable
                key={action.label}
                onPress={() => handleSend(action.label)}
                disabled={isLoading}
                className="bg-[#111] border border-[#1C1C1C] rounded-full px-3 py-1.5 mr-1.5 active:opacity-60"
              >
                <Text className="text-[12px] text-[#777] font-dm">
                  {action.icon} {action.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Input */}
          <View className="px-4 pb-1.5">
            <View className="flex-row items-end bg-[#111] rounded-full border border-[#1C1C1C] pl-4 pr-1.5 py-0.5">
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Message..."
                placeholderTextColor="#333"
                multiline
                maxLength={1000}
                className="flex-1 text-white font-dm text-[15px] py-2.5 max-h-24"
                returnKeyType="send"
                blurOnSubmit={false}
                onSubmitEditing={() => handleSend()}
              />
              <Pressable
                onPress={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className={`ml-1.5 mb-1 w-9 h-9 rounded-full items-center justify-center active:opacity-70 ${
                  input.trim() && !isLoading
                    ? "bg-brand-green"
                    : "bg-[#1A1A1A]"
                }`}
              >
                <Text
                  className={`text-base font-bold ${
                    input.trim() && !isLoading
                      ? "text-black"
                      : "text-[#333]"
                  }`}
                >
                  {"\u2191"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Sidebar overlay */}
      <ChatSidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userId={userId}
        currentConversationId={conversationIdRef.current}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
      />
    </View>
  );
}
