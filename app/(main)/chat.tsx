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
  Alert,
  NativeSyntheticEvent,
  NativeScrollEvent,
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
import { useRouter } from "expo-router";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import { useTrackingStore } from "../../store/useTrackingStore";
import { sendMessage, generateWelcome } from "../../lib/chatEngine";
import { analyzeFoodFromText } from "../../lib/foodAnalyzer";
import { QUICK_ACTIONS } from "../../lib/types";
import type { DietPlanData, ConversationItem, PinnedMessage, FoodAnalysisResult } from "../../lib/types";
import DietPlanCardComponent from "../../components/DietPlanCard";
import ChatSidebar from "../../components/ChatSidebar";
import FoodLogModal from "../../components/FoodLogModal";

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
function MessageBubble({
  item,
  isPinned,
  onLongPress,
}: {
  item: DisplayMessage;
  isPinned?: boolean;
  onLongPress?: () => void;
}) {
  const isUser = item.role === "user";

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={400}
      className={`px-5 mb-2.5 ${isUser ? "items-end" : "items-start"}`}
    >
      <View
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-[#1A2E0A] rounded-br-sm"
            : "bg-[#161616] rounded-bl-sm"
        }`}
        style={isPinned ? { borderWidth: 1, borderColor: "#A8FF3E" } : undefined}
      >
        {isPinned && (
          <Text style={{ color: "#A8FF3E", fontSize: 10, marginBottom: 2 }}>
            {"\uD83D\uDCCC"} Pinned
          </Text>
        )}
        <Text
          className={`text-[15px] leading-[22px] font-dm ${
            isUser ? "text-[#D4E8BC]" : "text-[#C8C8C8]"
          }`}
        >
          {item.content}
        </Text>
      </View>
    </Pressable>
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

// ── Pinned message banner (supports multiple) ──────────────────
function PinnedBanner({
  messages,
  onTap,
  onUnpin,
}: {
  messages: DisplayMessage[];
  onTap: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
}) {
  if (messages.length === 0) return null;
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: "#2a5a2a" }}>
      {messages.map((msg) => (
        <Pressable
          key={msg.id}
          onPress={() => onTap(msg.id)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#1A2E0A",
            paddingHorizontal: 16,
            paddingVertical: 7,
            borderBottomWidth: messages.length > 1 ? 0.5 : 0,
            borderBottomColor: "#2a5a2a",
          }}
        >
          <Text style={{ color: "#A8FF3E", fontSize: 12, marginRight: 8 }}>{"\uD83D\uDCCC"}</Text>
          <Text
            style={{ flex: 1, color: "#D4E8BC", fontSize: 13 }}
            numberOfLines={1}
          >
            {msg.content}
          </Text>
          <Pressable onPress={() => onUnpin(msg.id)} hitSlop={8}>
            <Text style={{ color: "#666", fontSize: 16, marginLeft: 8 }}>{"\u2715"}</Text>
          </Pressable>
        </Pressable>
      ))}
    </View>
  );
}

// ── Inline food prompt ──────────────────────────────────────────
function FoodPrompt({
  onSubmit,
  onCancel,
}: {
  onSubmit: (food: string) => void;
  onCancel: () => void;
}) {
  const [food, setFood] = useState("");
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#161616", paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#222" }}>
      <TextInput
        value={food}
        onChangeText={setFood}
        placeholder="What did you eat?"
        placeholderTextColor="#555"
        autoFocus
        style={{ flex: 1, color: "#fff", fontSize: 14, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: "#1A1A1A", borderRadius: 8 }}
      />
      <Pressable
        onPress={() => food.trim() && onSubmit(food.trim())}
        style={{ marginLeft: 8, backgroundColor: "#1A2E0A", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
      >
        <Text style={{ color: "#A8FF3E", fontWeight: "600", fontSize: 13 }}>Log</Text>
      </Pressable>
      <Pressable onPress={onCancel} style={{ marginLeft: 6, paddingHorizontal: 8, paddingVertical: 8 }}>
        <Text style={{ color: "#666", fontSize: 13 }}>Cancel</Text>
      </Pressable>
    </View>
  );
}

// ── Inline water prompt ─────────────────────────────────────────
function WaterPrompt({
  onSelect,
  onCancel,
}: {
  onSelect: (count: number) => void;
  onCancel: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#161616", paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#222", gap: 8 }}>
      <Text style={{ color: "#888", fontSize: 13, marginRight: 4 }}>{"\uD83D\uDCA7"} Glasses:</Text>
      {[1, 2, 3, 4].map((n) => (
        <Pressable
          key={n}
          onPress={() => onSelect(n)}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: pressed ? "#2a5a2a" : "#1A2E0A",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "#2a5a2a",
          })}
        >
          <Text style={{ color: "#A8FF3E", fontWeight: "bold", fontSize: 16 }}>{n}</Text>
        </Pressable>
      ))}
      <Pressable onPress={onCancel} style={{ marginLeft: "auto", paddingHorizontal: 8, paddingVertical: 8 }}>
        <Text style={{ color: "#666", fontSize: 13 }}>Cancel</Text>
      </Pressable>
    </View>
  );
}

// ── Main chat screen ────────────────────────────────────────────
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const logout = useAuthStore((s) => s.logout);
  const { addWater, waterGlasses, saveFoodLog, loadTodayLogs } = useTrackingStore();
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

  // Diet plan shown flag
  const dietPlanShownRef = useRef(false);

  // Pin state — multiple pins, persisted to Supabase
  const [pinnedMessageIds, setPinnedMessageIds] = useState<Set<string>>(new Set());

  // Inline prompt states
  const [showFoodPrompt, setShowFoodPrompt] = useState(false);
  const [showWaterPrompt, setShowWaterPrompt] = useState(false);
  const [showFoodLogModal, setShowFoodLogModal] = useState(false);

  // Smart scroll tracking
  const isNearBottomRef = useRef(true);

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

  // ── Load chat history + food logs on mount ──────────────────
  useEffect(() => {
    if (!userId) return;
    loadLatestConversation();
    loadTodayLogs(userId);
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
        loadPinnedMessages(latestConv.id);

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
      await supabase.from("conversations").insert({
        id: conversationIdRef.current,
        user_id: userId,
        title: title.slice(0, 40),
      });
    } catch {}
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
    setPinnedMessageIds(new Set());
    setShowFoodPrompt(false);
    setShowWaterPrompt(false);
    setShowFoodLogModal(false);

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
    setPinnedMessageIds(new Set());
    setShowFoodPrompt(false);
    setShowWaterPrompt(false);
    setShowFoodLogModal(false);

    loadPinnedMessages(conv.id);

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
    } catch {}
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
    } catch {}
  };

  // ── Scroll helpers ─────────────────────────────────────────
  const scrollToEnd = useCallback(() => {
    if (isNearBottomRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 60);
    }
  }, []);

  const forceScrollToEnd = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 60);
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    isNearBottomRef.current = distanceFromBottom < 120;
  }, []);

  // ── Handle personalize button ──────────────────────────────
  const handlePersonalize = useCallback(() => {
    handleSend("yes, customize my diet plan");
  }, []);

  // ── Load pinned messages from Supabase ──────────────────────
  const loadPinnedMessages = useCallback(async (convId: string) => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from("pinned_messages")
        .select("message_id")
        .eq("conversation_id", convId)
        .eq("user_id", userId);
      if (data) {
        setPinnedMessageIds(new Set(data.map((r: { message_id: string }) => r.message_id)));
      } else {
        setPinnedMessageIds(new Set());
      }
    } catch {
      setPinnedMessageIds(new Set());
    }
  }, [userId]);

  // ── Pin / unpin a message (persisted) ─────────────────────
  const handlePinMessage = useCallback(async (messageId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const convId = conversationIdRef.current;
    const wasPinned = pinnedMessageIds.has(messageId);

    // Optimistic update
    setPinnedMessageIds((prev) => {
      const next = new Set(prev);
      if (wasPinned) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });

    try {
      if (wasPinned) {
        await supabase
          .from("pinned_messages")
          .delete()
          .eq("conversation_id", convId)
          .eq("message_id", messageId)
          .eq("user_id", userId);
      } else {
        await supabase
          .from("pinned_messages")
          .upsert({
            conversation_id: convId,
            message_id: messageId,
            user_id: userId,
          }, { onConflict: "conversation_id,message_id" });
      }
    } catch {
      // Revert on failure
      setPinnedMessageIds((prev) => {
        const reverted = new Set(prev);
        if (wasPinned) reverted.add(messageId);
        else reverted.delete(messageId);
        return reverted;
      });
    }
  }, [pinnedMessageIds, userId]);

  const handleUnpinMessage = useCallback(async (messageId: string) => {
    const convId = conversationIdRef.current;
    setPinnedMessageIds((prev) => {
      const next = new Set(prev);
      next.delete(messageId);
      return next;
    });
    try {
      await supabase
        .from("pinned_messages")
        .delete()
        .eq("conversation_id", convId)
        .eq("message_id", messageId)
        .eq("user_id", userId);
    } catch {}
  }, [userId]);

  const handleScrollToPinned = useCallback((messageId: string) => {
    const index = listData.findIndex((item) => item.id === messageId);
    if (index >= 0) {
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
    }
  }, [listData]);

  // Resolve pinned message objects for the banner
  const pinnedMessages: DisplayMessage[] = listData.filter(
    (item) => pinnedMessageIds.has(item.id) && !isDietCard(item)
  ) as DisplayMessage[];

  // ── Logout handler ─────────────────────────────────────────
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    logout();
    router.replace("/(auth)");
  };

  // ── Process bubble queue ───────────────────────────────────
  const processBubbleQueue = useCallback(() => {
    if (isProcessingBubblesRef.current) return;
    if (bubbleQueueRef.current.length === 0) {
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
    setShowFoodPrompt(false);
    setShowWaterPrompt(false);

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
    forceScrollToEnd();

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

  // ── Quick action handlers ──────────────────────────────────
  const handleQuickAction = (label: string) => {
    switch (label) {
      case "Log Food":
        setShowWaterPrompt(false);
        setShowFoodPrompt(false);
        setShowFoodLogModal(true);
        break;
      case "My Plan": {
        // Find existing diet card in listData
        const dietIndex = listData.findIndex((item) => isDietCard(item));
        if (dietIndex >= 0) {
          flatListRef.current?.scrollToIndex({ index: dietIndex, animated: true, viewPosition: 0.3 });
        } else {
          handleSend("give me a diet plan");
        }
        break;
      }
      case "Motivate me":
        handleSend("Motivate me");
        break;
      case "Water intake":
        setShowFoodPrompt(false);
        setShowWaterPrompt(true);
        break;
      default:
        handleSend(label);
    }
  };

  const handleFoodSubmit = async (food: string) => {
    setShowFoodPrompt(false);
    try {
      setIsLoading(true);
      setShowTypingIndicator(true);

      // Add user message to chat
      const userMsg: DisplayMessage = {
        id: Date.now().toString(),
        role: "user",
        content: `I ate: ${food}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      forceScrollToEnd();
      ensureConversation(food);
      saveMessage("user", `I ate: ${food}`);

      const result = await analyzeFoodFromText(food);
      await saveFoodLog(userId, result);

      setShowTypingIndicator(false);

      const confirmText = `Logged: ${result.food_name} \u2014 ${result.calories} cal, ${result.protein_g}g P, ${result.carbs_g}g C, ${result.fat_g}g F \u2705`;
      const botMsg: DisplayMessage = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        content: confirmText,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
      saveMessage("assistant", confirmText);
      setCurrentBubbleText(confirmText);
      scrollToEnd();
    } catch {
      setShowTypingIndicator(false);
      const errMsg: DisplayMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "arre yaar food analyze nahi ho paya \uD83D\uDE05 try again?",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFoodAnalyzed = async (result: FoodAnalysisResult, imageUri?: string) => {
    try {
      setIsLoading(true);
      setShowTypingIndicator(true);
      forceScrollToEnd();

      await saveFoodLog(userId, result, imageUri);

      setShowTypingIndicator(false);

      const confirmText = `Logged: ${result.food_name} \u2014 ${result.calories} cal, ${result.protein_g}g P, ${result.carbs_g}g C, ${result.fat_g}g F \u2705`;
      const botMsg: DisplayMessage = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        content: confirmText,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
      ensureConversation(result.food_name);
      saveMessage("assistant", confirmText);
      setCurrentBubbleText(confirmText);
      scrollToEnd();
    } catch {
      setShowTypingIndicator(false);
      const errMsg: DisplayMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "food save nahi ho paya bhai \uD83D\uDE15 try again?",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWaterSelect = (count: number) => {
    setShowWaterPrompt(false);
    addWater(count);
    const total = waterGlasses + count;
    handleSend(`I just drank ${count} glass${count > 1 ? "es" : ""} of water. Total today: ${total} glasses.`);
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
            <Pressable
              onPress={() => setSidebarOpen(true)}
              className="w-9 h-9 rounded-full items-center justify-center active:opacity-60"
            >
              <Text className="text-[18px] text-[#888]">{"\u2630"}</Text>
            </Pressable>

            <View className="flex-row items-center">
              <Text className="text-[17px] text-white font-sora-semibold">
                Pal {"\uD83C\uDF3F"}
              </Text>
            </View>

            <View className="w-9 h-9" />
          </View>
        </View>

        {/* Pinned message banners */}
        {pinnedMessages.length > 0 && (
          <PinnedBanner
            messages={pinnedMessages}
            onTap={handleScrollToPinned}
            onUnpin={handleUnpinMessage}
          />
        )}

        {/* Messages */}
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

            return (
              <MessageBubble
                item={item as DisplayMessage}
                isPinned={pinnedMessageIds.has(item.id)}
                onLongPress={() => handlePinMessage(item.id)}
              />
            );
          }}
          contentContainerStyle={{
            paddingTop: 16,
            paddingBottom: 8,
            flexGrow: 1,
            justifyContent: "flex-end",
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({
                index: info.index,
                animated: true,
              });
            }, 200);
          }}
        />

        {/* Typing indicator */}
        {showTypingIndicator && <TypingIndicator />}

        {/* Inline prompts */}
        {showFoodPrompt && (
          <FoodPrompt
            onSubmit={handleFoodSubmit}
            onCancel={() => setShowFoodPrompt(false)}
          />
        )}
        {showWaterPrompt && (
          <WaterPrompt
            onSelect={handleWaterSelect}
            onCancel={() => setShowWaterPrompt(false)}
          />
        )}

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
                onPress={() => handleQuickAction(action.label)}
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

      {/* Food log modal */}
      <FoodLogModal
        visible={showFoodLogModal}
        onClose={() => setShowFoodLogModal(false)}
        onTypeFood={() => setShowFoodPrompt(true)}
        onFoodAnalyzed={handleFoodAnalyzed}
      />

      {/* Sidebar overlay */}
      <ChatSidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userId={userId}
        currentConversationId={conversationIdRef.current}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        profile={profile}
        onLogout={handleLogout}
      />
    </View>
  );
}
