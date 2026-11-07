'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

type ChatSignalProps = {
  active: boolean;
  className?: string;
};

type SignalScene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  network: THREE.Group;
};

function getSignalColor() {
  const [hue, saturation, lightness] = getComputedStyle(document.documentElement)
    .getPropertyValue('--primary')
    .trim()
    .split(/\s+/u)
    .map(Number.parseFloat);
  if ([hue, saturation, lightness].every(Number.isFinite)) {
    return new THREE.Color().setHSL(hue / 360, saturation / 100, lightness / 100);
  }
  return new THREE.Color('#176b89');
}

function createNetwork(color: THREE.Color) {
  const network = new THREE.Group();
  const pointCount = 84;
  const positions = new Float32Array(pointCount * 3);
  const edgePositions: number[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let index = 0; index < pointCount; index += 1) {
    const y = 1 - (index / (pointCount - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const angle = goldenAngle * index;
    const point = new THREE.Vector3(
      Math.cos(angle) * radius * 0.82,
      y * 0.82,
      Math.sin(angle) * radius * 0.82,
    );
    positions.set([point.x, point.y, point.z], index * 3);
  }

  for (let index = 0; index < pointCount; index += 1) {
    const offset = index * 3;
    for (const neighbor of [index + 1, index + 8]) {
      if (neighbor >= pointCount) continue;
      const neighborOffset = neighbor * 3;
      edgePositions.push(
        positions[offset], positions[offset + 1], positions[offset + 2],
        positions[neighborOffset], positions[neighborOffset + 1], positions[neighborOffset + 2],
      );
    }
  }

  const pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    pointGeometry,
    new THREE.PointsMaterial({ color, size: 0.035, transparent: true, opacity: 0.9 }),
  );
  network.add(points);

  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
  network.add(new THREE.LineSegments(
    edgeGeometry,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.24 }),
  ));

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 24, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }),
  );
  network.add(core);
  return network;
}

export default function ChatSignal({ active, className = '' }: ChatSignalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SignalScene | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 10);
    camera.position.z = 2.8;
    const network = createNetwork(getSignalColor());
    scene.add(network);

    const render = () => renderer.render(scene, camera);
    const resizeObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    });
    resizeObserver.observe(canvas);
    sceneRef.current = { renderer, scene, camera, network };

    return () => {
      resizeObserver.disconnect();
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      network.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (!active || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      scene.renderer.render(scene.scene, scene.camera);
      return;
    }

    const animate = () => {
      const currentScene = sceneRef.current;
      if (!currentScene) return;
      currentScene.network.rotation.y += 0.006;
      currentScene.network.rotation.x += 0.0015;
      currentScene.renderer.render(currentScene.scene, currentScene.camera);
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    };
  }, [active]);

  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center ${className}`} aria-hidden="true">
      <svg className="absolute inset-0 h-full w-full text-primary" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="36" stroke="currentColor" strokeOpacity=".22" />
        <circle cx="50" cy="50" r="24" stroke="currentColor" strokeOpacity=".28" />
        <circle cx="50" cy="50" r="5" fill="currentColor" fillOpacity=".72" />
        <path d="M25 35 42 46m33-11L58 46M28 66l15-11m29 11L57 55" stroke="currentColor" strokeOpacity=".35" />
        <circle cx="25" cy="35" r="2" fill="currentColor" />
        <circle cx="75" cy="35" r="2" fill="currentColor" />
        <circle cx="28" cy="66" r="2" fill="currentColor" />
        <circle cx="72" cy="66" r="2" fill="currentColor" />
      </svg>
      <canvas ref={canvasRef} className="relative h-full w-full" />
    </span>
  );
}
