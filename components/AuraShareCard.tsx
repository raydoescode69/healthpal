import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import type { AuraLabel } from "../lib/types";
import { getAuraColor } from "../lib/auraCalculator";

interface AuraShareCardProps {
  score: number;
  label: AuraLabel;
  sleepScore: number;
  nutritionScore: number;
  movementScore: number;
  hydrationScore: number;
}

const CARD_WIDTH = 360;
const CARD_HEIGHT = 640;
const ORB_SIZE = 160;

export default function AuraShareCard({
  score,
  label,
  sleepScore,
  nutritionScore,
  movementScore,
  hydrationScore,
}: AuraShareCardProps) {
  const color = getAuraColor(score);
  const cx = ORB_SIZE / 2;
  const cy = ORB_SIZE / 2;

  const stats = [
    { name: "Sleep", value: sleepScore },
    { name: "Nutrition", value: nutritionScore },
    { name: "Movement", value: movementScore },
    { name: "Hydration", value: hydrationScore },
  ];

  return (
    <View style={styles.card} collapsable={false}>
      {/* Branding */}
      <Text style={styles.brand}>Nyra</Text>

      {/* Static orb */}
      <View style={styles.orbContainer}>
        <Svg width={ORB_SIZE} height={ORB_SIZE}>
          <Circle cx={cx} cy={cy} r={ORB_SIZE / 2} fill={color} opacity={0.08} />
          <Circle cx={cx} cy={cy} r={ORB_SIZE / 2 * 0.75} fill={color} opacity={0.15} />
          <Circle cx={cx} cy={cy} r={ORB_SIZE / 2 * 0.5} fill={color} opacity={0.25} />
          <Circle cx={cx} cy={cy} r={ORB_SIZE / 2 * 0.35} fill={color} opacity={0.4} />
        </Svg>
        <View style={styles.scoreOverlay}>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreNumber}>{score}</Text>
            <Text style={styles.scoreSuffix}>/ 100</Text>
          </View>
        </View>
      </View>

      {/* Label */}
      <Text style={[styles.label, { color }]}>{label}</Text>

      {/* Stats */}
      <View style={styles.statsContainer}>
        {stats.map((stat) => (
          <View key={stat.name} style={styles.statRow}>
            <Text style={styles.statName}>{stat.name}</Text>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    backgroundColor: color,
                    width: `${Math.min(100, stat.value)}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.statValue}>{stat.value}%</Text>
          </View>
        ))}
      </View>

      {/* Watermark */}
      <Text style={styles.watermark}>nyra.app</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: "#0D0D0D",
    borderRadius: 24,
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  brand: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 2,
    marginBottom: 32,
  },
  orbContainer: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  scoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  scoreNumber: {
    fontSize: 36,
    fontWeight: "700",
    color: "#fff",
  },
  scoreSuffix: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.5)",
    marginLeft: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 4,
    marginBottom: 32,
  },
  statsContainer: {
    width: "100%",
    gap: 16,
    flex: 1,
    justifyContent: "center",
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statName: {
    width: 80,
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  statValue: {
    width: 40,
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "500",
    textAlign: "right",
  },
  watermark: {
    fontSize: 12,
    color: "rgba(255,255,255,0.2)",
    letterSpacing: 1,
    marginTop: 16,
  },
});
