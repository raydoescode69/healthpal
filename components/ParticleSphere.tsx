import React, { useRef, useEffect, useCallback } from "react";
import { View, PixelRatio } from "react-native";
import { GLView } from "expo-gl";
import { Renderer } from "expo-three";
// @ts-ignore — three.js types not bundled
import * as THREE from "three";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

interface ParticleSphereProps {
  isSpeaking: boolean;
  isListening?: boolean;
  size: number;
}

const PARTICLE_COUNT = 500;
const ACCENT_COLOR = 0xa8ff3e;

function fibonacciSphere(count: number, radius: number): Float32Array {
  const positions = new Float32Array(count * 3);
  const goldenRatio = (1 + Math.sqrt(5)) / 2;

  for (let i = 0; i < count; i++) {
    const theta = (2 * Math.PI * i) / goldenRatio;
    const phi = Math.acos(1 - (2 * (i + 0.5)) / count);

    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }

  return positions;
}

export default function ParticleSphere({ isSpeaking, isListening = false, size }: ParticleSphereProps) {
  const isSpeakingRef = useRef(isSpeaking);
  const isListeningRef = useRef(isListening);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const glRef = useRef<any>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      // Normalize touch to -1..1 range
      touchRef.current = {
        x: (e.x / size) * 2 - 1,
        y: -((e.y / size) * 2 - 1),
      };
    })
    .onEnd(() => {
      touchRef.current = null;
    });

  const onContextCreate = useCallback(async (gl: any) => {
    glRef.current = gl;
    const pixelRatio = PixelRatio.get();

    const renderer = new Renderer({ gl }) as any;
    renderer.setSize(gl.drawingBufferWidth / pixelRatio, gl.drawingBufferHeight / pixelRatio);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.1,
      1000
    );
    camera.position.z = 4;

    // Create particles
    const radius = 1.2;
    const basePositions = fibonacciSphere(PARTICLE_COUNT, radius);
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(basePositions);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: ACCENT_COLOR,
      size: 0.04,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const clock = new THREE.Clock();

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);

      const elapsed = clock.getElapsedTime();

      // Auto-rotation
      points.rotation.y += 0.003;
      points.rotation.x += 0.001;

      // Speaking pulse — strong, rhythmic
      if (isSpeakingRef.current) {
        const scale = 1.0 + 0.12 * Math.sin(elapsed * 4);
        points.scale.set(scale, scale, scale);
      } else if (isListeningRef.current) {
        // Listening pulse — quicker, smaller breathing to show it's active
        const scale = 1.0 + 0.06 * Math.sin(elapsed * 6);
        points.scale.set(scale, scale, scale);
      } else {
        // Gentle idle breathing
        const idle = 1.0 + 0.02 * Math.sin(elapsed * 1.5);
        points.scale.set(idle, idle, idle);
      }

      // Touch deformation
      const posAttr = geometry.attributes.position as THREE.BufferAttribute;
      const posArray = posAttr.array as Float32Array;
      const touch = touchRef.current;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const bx = basePositions[i * 3];
        const by = basePositions[i * 3 + 1];
        const bz = basePositions[i * 3 + 2];

        if (touch) {
          // Project particle to screen space (simplified)
          const screenX = bx / (radius * 1.2);
          const screenY = by / (radius * 1.2);
          const dx = screenX - touch.x;
          const dy = screenY - touch.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 0.5) {
            const pushStrength = (0.5 - dist) * 0.4;
            const len = Math.sqrt(bx * bx + by * by + bz * bz) || 1;
            posArray[i * 3] = bx + (bx / len) * pushStrength;
            posArray[i * 3 + 1] = by + (by / len) * pushStrength;
            posArray[i * 3 + 2] = bz + (bz / len) * pushStrength;
          } else {
            posArray[i * 3] = bx;
            posArray[i * 3 + 1] = by;
            posArray[i * 3 + 2] = bz;
          }
        } else {
          // Lerp back to base positions
          posArray[i * 3] += (bx - posArray[i * 3]) * 0.1;
          posArray[i * 3 + 1] += (by - posArray[i * 3 + 1]) * 0.1;
          posArray[i * 3 + 2] += (bz - posArray[i * 3 + 2]) * 0.1;
        }
      }
      posAttr.needsUpdate = true;

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };

    animate();
  }, [size]);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <GestureDetector gesture={pan}>
      <View style={{ width: size, height: size }}>
        <GLView
          style={{ width: size, height: size }}
          onContextCreate={onContextCreate}
        />
      </View>
    </GestureDetector>
  );
}
