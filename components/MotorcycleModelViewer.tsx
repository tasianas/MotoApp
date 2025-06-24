import { Asset } from "expo-asset";
import { GLView } from "expo-gl";
import { Renderer } from "expo-three";
import React, { useEffect, useRef, useState } from "react";
import { PanResponder, Platform, StyleSheet, Text, View } from "react-native";
import {
  AmbientLight,
  Box3,
  BoxGeometry,
  DataTexture,
  DirectionalLight,
  Group,
  HemisphereLight,
  LoadingManager,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  RGBAFormat,
  Scene,
  TextureLoader,
  UnsignedByteType,
  Vector3,
} from "three";

let GLTFLoader: any = null;
try {
  GLTFLoader = require("three/examples/jsm/loaders/GLTFLoader").GLTFLoader;
} catch (error) {
  console.warn("GLTFLoader not available, will use fallback:", error);
}

// Custom texture loading solution for React Native
const createMobileCompatibleTexture = () => {
  // Create a simple 1x1 white texture
  const data = new Uint8Array([255, 255, 255, 255]); // RGBA white pixel
  const texture = new DataTexture(data, 1, 1, RGBAFormat, UnsignedByteType);
  texture.needsUpdate = true;
  return texture;
};

// Enhanced texture loading solution for React Native
const createReactNativeCompatibleLoader = () => {
  if (Platform.OS === "web" || !GLTFLoader) {
    return GLTFLoader;
  }

  // Create a custom GLTF loader class that handles texture issues
  class ReactNativeGLTFLoader extends GLTFLoader {
    constructor(manager?: LoadingManager) {
      super(manager);

      // Override the texture loading to prevent blob creation errors
      const originalParse = this.parse.bind(this);
      this.parse = (
        data: any,
        path: string,
        onLoad: Function,
        onError: Function
      ) => {
        try {
          // Call original parse but catch texture errors
          originalParse(
            data,
            path,
            (gltf: any) => {
              // Process the loaded GLTF to remove problematic textures
              if (gltf.scene) {
                gltf.scene.traverse((child: any) => {
                  if (child.isMesh && child.material) {
                    const materials = Array.isArray(child.material)
                      ? child.material
                      : [child.material];
                    materials.forEach((material: any) => {
                      // Remove all texture maps that might cause blob errors
                      material.map = null;
                      material.normalMap = null;
                      material.roughnessMap = null;
                      material.metalnessMap = null;
                      material.aoMap = null;
                      material.emissiveMap = null;
                      material.needsUpdate = true;
                    });
                  }
                });
              }
              onLoad(gltf);
            },
            onError
          );
        } catch (error) {
          console.warn(
            "GLTF parsing error, will handle in material processing:",
            error
          );
          // Still try the original parse, let material processing handle issues
          originalParse(data, path, onLoad, onError);
        }
      };
    }
  }

  return ReactNativeGLTFLoader;
};

// Patch THREE.js texture loading for React Native compatibility
const patchThreeJSForMobile = () => {
  if (Platform.OS !== "web") {
    try {
      // 1. Enhanced Patch for TextureLoader to completely bypass actual texture loading
      const originalLoad = TextureLoader.prototype.load;
      TextureLoader.prototype.load = function (
        url: string,
        onLoad?: any,
        onProgress?: any,
        onError?: any
      ) {
        console.log("Using fallback texture for React Native compatibility");
        // Create a dummy texture that won't cause Blob errors
        const texture = createMobileCompatibleTexture();

        // Mark it as loaded to prevent further loading attempts
        texture.needsUpdate = true;

        // Call onLoad immediately to prevent waiting
        if (onLoad) {
          setTimeout(() => onLoad(texture), 0);
        }
        return texture;
      };

      // 2. Patch FileLoader to prevent blob-related operations
      const THREE = require("three");
      if (THREE.FileLoader) {
        const originalFileLoad = THREE.FileLoader.prototype.load;
        THREE.FileLoader.prototype.load = function (
          url: string,
          onLoad?: any,
          onProgress?: any,
          onError?: any
        ) {
          // For texture files, return empty data to prevent blob operations
          if (
            url &&
            (url.includes(".jpg") ||
              url.includes(".png") ||
              url.includes(".jpeg") ||
              url.includes(".webp"))
          ) {
            console.warn("File loading disabled for texture file:", url);
            if (onLoad) {
              setTimeout(() => onLoad(new ArrayBuffer(0)), 0);
            }
            return;
          }
          // For non-texture files, use original loader
          return originalFileLoad.call(this, url, onLoad, onProgress, onError);
        };
      }

      // 3. Disable blob creation globally if possible (safely)
      if (typeof global !== "undefined" && !global.Blob) {
        (global as any).Blob = class FakeBlob {
          constructor(...args: any[]) {
            console.warn(
              "Blob creation intercepted and disabled for React Native"
            );
            throw new Error(
              "Blob creation disabled for React Native compatibility"
            );
          }
        };
      }

      console.log("Applied comprehensive mobile texture loading patches");
    } catch (error) {
      console.warn("Some texture patches failed, but continuing:", error);
    }
  }
};

// More aggressive patching to prevent blob creation in GLTF loader
const patchGLTFLoaderForMobile = () => {
  if (Platform.OS !== "web" && GLTFLoader) {
    try {
      // Patch the GLTFLoader prototype to handle texture loading issues
      const originalLoad = GLTFLoader.prototype.load;
      GLTFLoader.prototype.load = function (
        url: string,
        onLoad?: any,
        onProgress?: any,
        onError?: any
      ) {
        const manager = this.manager || new LoadingManager();

        // Override the load manager's onError to handle texture failures gracefully
        const originalOnError = manager.onError;
        manager.onError = (errorUrl: string) => {
          console.warn(
            `GLTF texture loading failed for: ${errorUrl}, continuing with fallback`
          );
          // Don't call the original error handler for texture files
          if (
            !errorUrl.includes(".jpg") &&
            !errorUrl.includes(".png") &&
            !errorUrl.includes(".jpeg") &&
            !errorUrl.includes(".webp")
          ) {
            if (originalOnError) originalOnError(errorUrl);
          }
        };

        // Patch the FileLoader in the manager to prevent blob operations
        const THREE = require("three");
        if (THREE.FileLoader && manager.getHandler) {
          const originalGetHandler = manager.getHandler;
          manager.getHandler = function (file: string) {
            const handler = originalGetHandler.call(this, file);
            if (
              handler &&
              (file.includes(".jpg") ||
                file.includes(".png") ||
                file.includes(".jpeg") ||
                file.includes(".webp"))
            ) {
              // Return null handler for texture files to skip loading
              return null;
            }
            return handler;
          };
        }

        return originalLoad.call(this, url, onLoad, onProgress, onError);
      };

      console.log("Applied GLTF loader texture patches");
    } catch (error) {
      console.warn("GLTF loader patching failed:", error);
    }
  }
};

// Most aggressive patch - modify the GLTF parser to skip textures entirely
const patchGLTFParserForMobile = () => {
  if (Platform.OS !== "web" && GLTFLoader) {
    try {
      // Get the THREE module
      const THREE = require("three");

      // Patch the GLTFParser if available
      if (THREE.GLTFLoader && THREE.GLTFLoader.prototype._invokeAll) {
        const originalInvokeAll = THREE.GLTFLoader.prototype._invokeAll;
        THREE.GLTFLoader.prototype._invokeAll = function (fn: Function) {
          try {
            return originalInvokeAll.call(this, fn);
          } catch (error: any) {
            if (error.message && error.message.includes("blob")) {
              console.warn(
                "Blob-related operation skipped for React Native compatibility"
              );
              return Promise.resolve();
            }
            throw error;
          }
        };
      }

      // Also try to patch the internal loader mechanisms
      if (THREE.Loader && THREE.Loader.prototype.load) {
        const originalLoaderLoad = THREE.Loader.prototype.load;
        THREE.Loader.prototype.load = function (
          url: string,
          onLoad?: Function,
          onProgress?: Function,
          onError?: Function
        ) {
          // Skip loading for texture files
          if (
            url &&
            (url.includes(".jpg") ||
              url.includes(".png") ||
              url.includes(".jpeg") ||
              url.includes(".webp") ||
              url.includes(".ktx"))
          ) {
            console.warn("Texture file loading skipped:", url);
            if (onLoad) {
              // Return a fake texture-like object
              setTimeout(() => onLoad(createMobileCompatibleTexture()), 0);
            }
            return;
          }
          return originalLoaderLoad.call(
            this,
            url,
            onLoad,
            onProgress,
            onError
          );
        };
      }

      console.log("Applied GLTF parser texture patches");
    } catch (error) {
      console.warn("GLTF parser patching failed:", error);
    }
  }
};

interface MotorcycleModelViewerProps {
  width: number;
  height: number;
  autoRotate?: boolean;
}

export default function MotorcycleModelViewer({
  width,
  height,
  autoRotate = true,
}: MotorcycleModelViewerProps) {
  const sceneRef = useRef<Scene | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const bikeModelRef = useRef<Group | null>(null);
  const rotationRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(2.0); // Initial zoom factor (matched to our new setup)
  const autoRotationRef = useRef(0);
  const velocityRef = useRef({ x: 0, y: 0 }); // For smooth rotation
  const pinchDataRef = useRef<{
    initialDistance?: number;
    initialZoom?: number;
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Apply global patches on component mount
  useEffect(() => {
    patchThreeJSForMobile();
    patchGLTFLoaderForMobile();
    patchGLTFParserForMobile();
  }, []);

  // Dynamic lighting adjustment function for optimal visibility
  const adjustLightingForCameraPosition = () => {
    if (cameraRef.current && sceneRef.current) {
      const camera = cameraRef.current;
      const scene = sceneRef.current;

      // Find or create dynamic lights
      const existingLights = scene.children.filter(
        (child: any) =>
          child.type === "PointLight" && child.name === "dynamicLight"
      );

      // Remove existing dynamic lights
      existingLights.forEach((light: any) => scene.remove(light));

      // Add new dynamic light positioned relative to camera
      const dynamicLight = new PointLight(0xffffff, 0.5, 30);
      (dynamicLight as any).name = "dynamicLight";
      dynamicLight.position.copy(camera.position);
      dynamicLight.position.y += 2; // Slightly above camera
      scene.add(dynamicLight);
    }
  }; // Setup improved lighting for better model visibility
  const setupLighting = (scene: Scene) => {
    console.log("Setting up lighting");

    // Ambient light for base illumination (a bit brighter)
    const ambientLight = new AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    // Hemisphere light for natural environment lighting
    const hemisphereLight = new HemisphereLight(0xffffff, 0x222222, 0.6);
    scene.add(hemisphereLight);

    // Directional main light (like sun) - from front right
    const mainLight = new DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(2, 4, 5);
    mainLight.castShadow = true;
    scene.add(mainLight);

    // Front fill light - from left
    const frontLight = new DirectionalLight(0xffffff, 0.7);
    frontLight.position.set(-3, 2, 3);
    scene.add(frontLight);

    // Back rim light - for highlighting edges
    const backLight = new DirectionalLight(0xfffffb, 0.8);
    backLight.position.set(0, 3, -5);
    scene.add(backLight);

    // Bottom subtle light - for illuminating underside
    const fillLight = new PointLight(0xffffff, 0.3);
    fillLight.position.set(0, -1, 0);
    scene.add(fillLight);

    console.log("Enhanced lighting setup complete");
  };

  // Enhanced pan responder with zoom and smooth rotation
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt) => {
      // Always respond to touch for better interaction
      return true;
    },
    onMoveShouldSetPanResponderCapture: () => true,

    onPanResponderGrant: () => {
      // Store initial rotation when touch starts
      if (bikeModelRef.current) {
        rotationRef.current.x = bikeModelRef.current.rotation.x;
        rotationRef.current.y = bikeModelRef.current.rotation.y;
      }
      // Reset velocity
      velocityRef.current = { x: 0, y: 0 };
      // Reset pinch data
      pinchDataRef.current = {};
    },

    onPanResponderMove: (evt, gestureState) => {
      const touches = evt.nativeEvent.touches;

      // Handle single touch - rotation
      if (touches.length === 1 && bikeModelRef.current) {
        const sensitivity = 0.0004; // Much slower rotation (reduced from 0.008)

        // Calculate rotation deltas
        const deltaY = gestureState.dx * sensitivity; // Horizontal rotation
        const deltaX = gestureState.dy * (sensitivity - 0.0003); // Vertical rotation (back to original direction)

        // Update velocity for smooth momentum
        velocityRef.current.x = deltaX;
        velocityRef.current.y = deltaY;

        // Apply rotation
        rotationRef.current.y += deltaY;
        rotationRef.current.x += deltaX;

        // Limit vertical rotation to prevent flipping
        rotationRef.current.x = Math.max(
          -Math.PI / 3, // Allow more vertical rotation
          Math.min(Math.PI / 3, rotationRef.current.x)
        );

        // Apply smooth rotations
        bikeModelRef.current.rotation.y = rotationRef.current.y;
        bikeModelRef.current.rotation.x = rotationRef.current.x;
      }

      // Handle two-finger pinch for zoom
      else if (touches.length === 2 && cameraRef.current) {
        const touch1 = touches[0];
        const touch2 = touches[1];

        // Calculate distance between fingers
        const distance = Math.sqrt(
          Math.pow(touch2.pageX - touch1.pageX, 2) +
            Math.pow(touch2.pageY - touch1.pageY, 2)
        );

        // Store initial distance if not set
        if (!pinchDataRef.current.initialDistance) {
          pinchDataRef.current.initialDistance = distance;
          pinchDataRef.current.initialZoom = zoomRef.current;
        }

        // Calculate zoom factor
        const zoomFactor = pinchDataRef.current.initialDistance! / distance;
        const newZoom = pinchDataRef.current.initialZoom! * zoomFactor;

        // Limit zoom range for better UX - allow much closer zoom (from 1.0 to 0.5)
        zoomRef.current = Math.max(0.5, Math.min(12, newZoom));

        // Apply zoom by moving camera smoothly
        const camera = cameraRef.current;
        // Position camera while maintaining the x and y position
        camera.position.set(
          1.0, // Keep x position consistent with initial setup
          0.75, // Keep y position consistent with initial setup
          (4.0 * zoomRef.current) / 2.0 // Scale z position based on zoom
        );
        camera.lookAt(1.0, -0.3, 0); // Keep looking at the center of the model
      }
    },

    onPanResponderRelease: () => {
      // Reset pinch data
      pinchDataRef.current = {};

      // Optional: Add smooth momentum here if desired
      // You could implement a decay animation using velocityRef.current
    },
  });

  const onContextCreate = async (gl: any) => {
    console.log("GL Context created");
    try {
      // GL setup
      const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
      const sceneColor = 0x151515;

      // Create a WebGLRenderer with alpha transparency
      const renderer = new Renderer({ gl, alpha: true });
      renderer.setSize(width, height);
      renderer.setClearColor(0x000000, 0); // Fully transparent background
      rendererRef.current = renderer;

      // Create a scene
      const scene = new Scene();
      scene.background = null; // Keep transparent, the app background will show through

      // Create a camera with better positioning for a smaller model
      const camera = new PerspectiveCamera(45, width / height, 0.01, 1000); // Wider FOV to see more
      camera.position.set(1.0, 0.4, 5.0); // Moved further back for a smaller appearance
      camera.lookAt(1.0, -0.2, 0); // Look at the motorcycle's center
      cameraRef.current = camera;

      // Add lights
      setupLighting(scene);

      // Load and add the 3D model
      console.log(
        "Loading model from:",
        require("../assets/models/ducati_v4r.glb")
      );
      const modelUri = Asset.fromModule(
        require("../assets/models/ducati_v4r.glb")
      ).uri;

      // Only try to load the actual model
      try {
        // Apply mobile compatibility patches
        patchThreeJSForMobile();
        patchGLTFLoaderForMobile();
        const OptimizedGLTFLoader = createReactNativeCompatibleLoader();

        if (!OptimizedGLTFLoader) {
          throw new Error("GLTFLoader not available");
        }

        await Asset.loadAsync(require("../assets/models/ducati_v4r.glb"));
        const localUri = Asset.fromModule(
          require("../assets/models/ducati_v4r.glb")
        );
        console.log("Model asset loaded:", localUri.uri);

        const modelData: any = await new Promise((resolve, reject) => {
          try {
            const loader = new OptimizedGLTFLoader();
            loader.load(
              localUri.uri,
              (gltf: any) => {
                console.log("GLTF model loaded successfully");
                resolve(gltf);
              },
              (progress: any) => {
                console.log(
                  `Loading progress: ${
                    (progress.loaded / progress.total) * 100
                  }%`
                );
              },
              (error: any) => {
                console.error("Error loading GLTF model:", error);
                reject(error);
              }
            );
          } catch (err: any) {
            console.error("Error in GLTF loader setup:", err);
            reject(err);
          }
        });

        // Extract the model from the GLTF data
        const model = modelData.scene || modelData;
        if (!model) {
          throw new Error("No valid model found in GLTF data");
        }

        // Process the model
        model.traverse((child: any) => {
          if (child.isMesh && child.material) {
            // This ensures all meshes cast and receive shadows
            child.castShadow = true;
            child.receiveShadow = true;

            // Handle materials
            if (Array.isArray(child.material)) {
              child.material.forEach((material: any) => {
                material.color = material.color || { setHex: () => {} };
                material.needsUpdate = true;
              });
            } else {
              child.material.color = child.material.color || {
                setHex: () => {},
              };
              child.material.needsUpdate = true;
            }
          }
        });

        // Set model position and add to scene
        model.position.set(0, 0, 0);
        model.scale.set(1, 1, 1);
        scene.add(model);

        // Set the model reference
        bikeModelRef.current = model;
        console.log("Model added to scene successfully");

        // Get model dimensions for positioning
        const boundingBox = new Box3().setFromObject(model);
        const center = boundingBox.getCenter(new Vector3());
        const size = boundingBox.getSize(new Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        // Center the model properly
        model.position.sub(center);

        // Make necessary adjustments to center it in the view
        model.position.x = 1.0;
        model.position.y = -0.3;
        model.position.z = 0;

        // Scale the model to fit the view - smaller size to fit screen better
        const idealSize = 3.0; // Reduced from 4.0 to make the bike smaller
        const scale = idealSize / maxDim;

        // Set ideal viewing angle and scale
        model.rotation.y = Math.PI * 0.25;
        model.rotation.x = Math.PI * 0.05;
        model.scale.set(scale, scale, scale);

        // Update loading state
        setModelLoaded(true);
        setLoading(false);
      } catch (modelError: any) {
        console.error("Failed to load model:", modelError);
        setError(
          `Failed to load 3D model: ${modelError?.message || "Unknown error"}`
        );
        setLoading(false);

        // Create a placeholder geometric shape as fallback
        createFallbackModel(scene);
      }

      // Animation loop
      const render = () => {
        requestAnimationFrame(render);

        // Rotate the model if autoRotate is enabled and the model is loaded
        if (autoRotate && bikeModelRef.current) {
          bikeModelRef.current.rotation.y += 0.005;
        }

        if (cameraRef.current) {
          renderer.render(scene, cameraRef.current);
        }
        gl.endFrameEXP();
      };
      render();
    } catch (err: any) {
      console.error("Error in GL context setup:", err);
      setError(`GL setup error: ${err?.message || "Unknown error"}`);
      setLoading(false);
    }
  };

  const loadMotorcycleModel = async (scene: Scene) => {
    try {
      console.log("Starting motorcycle model load...");

      // Check if GLTFLoader is available
      if (!GLTFLoader) {
        console.log("GLTFLoader not available, using fallback model");
        // Create a simple geometric motorcycle fallback
        const bikeGroup = new Group();
        const bikeBody = new Mesh(new BoxGeometry(2, 0.8, 4));
        bikeGroup.add(bikeBody);
        bikeModelRef.current = bikeGroup;
        scene.add(bikeGroup);
        setModelLoaded(true);
        return;
      }

      // Simplified asset loading approach with better debugging
      console.log("Loading motorcycle asset...");
      let modelUri: string;

      try {
        // First, let's check what the require actually returns
        const requiredAsset = require("../assets/models/ducati_v4r.glb");
        console.log(
          "Raw require result:",
          requiredAsset,
          "Type:",
          typeof requiredAsset
        );

        if (Platform.OS !== "web") {
          // For mobile platforms
          if (typeof requiredAsset === "number") {
            // This is a bundled asset ID from Metro
            console.log("Detected Metro asset ID:", requiredAsset);
            const modelAsset = Asset.fromModule(requiredAsset);
            await modelAsset.downloadAsync();
            modelUri = modelAsset.localUri || modelAsset.uri;
            console.log("Metro asset resolved to URI:", modelUri);
          } else if (typeof requiredAsset === "string") {
            // This is already a URI/path
            modelUri = requiredAsset;
            console.log("Direct string URI:", modelUri);
          } else {
            // Unknown type, try to use Asset.fromModule anyway
            console.log("Unknown asset type, trying Asset.fromModule...");
            const modelAsset = Asset.fromModule(requiredAsset);
            await modelAsset.downloadAsync();
            modelUri = modelAsset.localUri || modelAsset.uri;
            console.log("Fallback Asset.fromModule URI:", modelUri);
          }
        } else {
          // For web platform
          modelUri = "./assets/models/ducati_v4r.glb";
          console.log("Web platform URI:", modelUri);
        }

        if (!modelUri) {
          throw new Error(
            "Could not determine model URI - modelUri is null/undefined"
          );
        }

        console.log("Motorcycle asset ready for loading, final URI:", modelUri);
      } catch (assetError) {
        console.error("Asset loading failed with error:", assetError);
        console.log("Loading fallback model due to asset error...");
        // Create a simple geometric fallback
        const bikeGroup = new Group();
        const bikeBody = new Mesh(new BoxGeometry(2, 0.8, 4));
        bikeGroup.add(bikeBody);
        bikeModelRef.current = bikeGroup;
        scene.add(bikeGroup);
        setModelLoaded(true);
        return;
      }

      // Create a loading manager with texture error handling
      const manager = new LoadingManager();

      // Handle loading progress
      manager.onProgress = (
        url: string,
        itemsLoaded: number,
        itemsTotal: number
      ) => {
        const progress = (itemsLoaded / itemsTotal) * 100;
        setLoadingProgress(progress);
        console.log(`Loading progress: ${progress.toFixed(1)}%`);
      };

      // Handle loading errors gracefully
      manager.onError = (url: string) => {
        console.warn(`Failed to load resource: ${url}`);
        // Don't fail the entire load for a single resource
      };

      // Handle texture loading errors by patching the loader and using proper fallbacks
      const patchTextureLoader = () => {
        try {
          // Apply mobile compatibility patches
          patchThreeJSForMobile();
          console.log("Applied mobile texture loading patches");
        } catch (error) {
          console.warn("Texture loader patch failed:", error);
        }
      };

      patchTextureLoader();

      // Create GLTFLoader with React Native compatibility
      const LoaderClass = createReactNativeCompatibleLoader();
      const loader = new LoaderClass(manager);

      console.log("Loading motorcycle GLB model...");

      // Load the GLTF model with comprehensive error handling and texture bypass
      loader.load(
        modelUri,
        (gltf: any) => {
          try {
            console.log("Motorcycle GLB model loaded successfully!");
            const model = gltf.scene;

            // Process the model to handle any texture issues with enhanced error handling
            model.traverse((child: any) => {
              if (child.isMesh && child.material) {
                try {
                  // Clone material to avoid affecting other instances
                  const material = child.material.clone();

                  // Handle texture loading issues specifically for React Native
                  if (Platform.OS !== "web") {
                    // For mobile platforms, replace problematic textures with solid colors
                    if (material.map) {
                      // Remove the texture and use color instead
                      material.map = null;
                    }
                    if (material.normalMap) material.normalMap = null;
                    if (material.roughnessMap) material.roughnessMap = null;
                    if (material.metalnessMap) material.metalnessMap = null;
                    if (material.aoMap) material.aoMap = null;
                    if (material.emissiveMap) material.emissiveMap = null;
                  }

                  // Ensure there's a base color
                  if (!material.color) {
                    material.color = {
                      r: 0.608,
                      g: 0.643,
                      b: 0.682,
                      setHex: (hex: number) => {},
                    };
                  }

                  // Force material update and enable necessary properties for mobile
                  material.needsUpdate = true;
                  material.transparent = material.transparent || false;
                  material.side = 2; // DoubleSide for better visibility

                  // Improved material name detection - check using 'includes' for both material name and mesh name
                  const materialName = (material.name || "").toLowerCase();
                  const meshName = (child.name || "").toLowerCase();

                  // Add debug info
                  console.log(
                    `Processing material: ${materialName}, mesh: ${meshName}`
                  );

                  // Check both material and mesh names for better part identification
                  if (
                    materialName.includes("body") ||
                    materialName.includes("fairing") ||
                    materialName.includes("tank") ||
                    meshName.includes("body") ||
                    meshName.includes("fairing") ||
                    meshName.includes("tank") ||
                    meshName.includes("paint") ||
                    // Match body parts by analyzing mesh geometry
                    (child.geometry &&
                      child.geometry.attributes &&
                      child.geometry.attributes.position &&
                      child.geometry.attributes.position.count > 5000)
                  ) {
                    // Ducati Red for main body parts
                    material.metalness = 0.85; // Higher metalness for better reflection
                    material.roughness = 0.15; // Lower roughness for smoother appearance
                    material.emissive.setHex(0x080808); // Very subtle glow
                    console.log(
                      "Applied motorcycle body paint color (Ducati Red)"
                    );
                  } else if (
                    materialName.includes("metal") ||
                    materialName.includes("chrome") ||
                    meshName.includes("metal") ||
                    meshName.includes("chrome") ||
                    meshName.includes("silver") ||
                    meshName.includes("exhaust")
                  ) {
                    // Chrome/metal parts - enhanced reflectivity
                    material.color.setHex(0xe0e0e0); // Brighter chrome
                    material.metalness = 0.95;
                    material.roughness = 0.02; // Very smooth for high reflection
                    material.emissive.setHex(0x0a0a0a); // Subtle glow
                    console.log("Applied chrome/metal material");
                  } else if (
                    materialName.includes("rubber") ||
                    materialName.includes("tire") ||
                    meshName.includes("tire") ||
                    meshName.includes("wheel") ||
                    meshName.includes("rubber")
                  ) {
                    // Tires - enhanced contrast
                    material.color.setHex(0x1a1a1a); // Pure black tires
                    material.metalness = 0.0;
                    material.roughness = 0.9; // Very rough for rubber appearance
                    console.log("Applied tire/rubber material");
                  } else if (
                    materialName.includes("glass") ||
                    materialName.includes("window") ||
                    materialName.includes("screen") ||
                    materialName.includes("visor") ||
                    meshName.includes("glass") ||
                    meshName.includes("window") ||
                    meshName.includes("screen") ||
                    meshName.includes("visor")
                  ) {
                    // Glass/windscreen - enhanced visibility with less blue tint
                    material.color.setHex(0xd8e6f0); // Very light blue tint (less blue)
                    material.metalness = 0.2;
                    material.roughness = 0.0;
                    material.opacity = 0.3;
                    material.transparent = true;
                    material.emissive.setHex(0x001122); // Reduced blue glow
                    console.log("Applied glass/windscreen material");
                  } else if (
                    materialName.includes("light") ||
                    materialName.includes("headlight") ||
                    materialName.includes("taillight") ||
                    meshName.includes("light") ||
                    meshName.includes("lamp") ||
                    meshName.includes("led")
                  ) {
                    // Lights - make them glow
                    material.color.setHex(0xffffff);
                    material.metalness = 0.0;
                    material.roughness = 0.1;
                    material.emissive.setHex(0x666666); // Brighter emissive glow
                    console.log("Applied light/lamp material");
                  } else if (
                    materialName.includes("seat") ||
                    meshName.includes("seat") ||
                    meshName.includes("saddle")
                  ) {
                    // Seat - darker black
                    material.color.setHex(0x222222); // Darker seat
                    material.metalness = 0.1;
                    material.roughness = 0.8;
                    console.log("Applied seat material");
                  } else if (
                    materialName.includes("accent") ||
                    materialName.includes("detail") ||
                    materialName.includes("stripe") ||
                    materialName.includes("logo") ||
                    meshName.includes("accent") ||
                    meshName.includes("detail") ||
                    meshName.includes("stripe") ||
                    meshName.includes("logo") ||
                    meshName.includes("badge")
                  ) {
                    // Accent details
                    material.color.setHex(0xffffff); // White accents
                    material.metalness = 0.6;
                    material.roughness = 0.2;
                    material.emissive.setHex(0x222222); // Enhanced glow
                    console.log("Applied accent/detail material");
                  } else if (
                    materialName.includes("carbon") ||
                    meshName.includes("carbon") ||
                    meshName.includes("fiber")
                  ) {
                    // Carbon fiber parts
                    material.color.setHex(0x1d1e20); // Carbon fiber color
                    material.metalness = 0.4;
                    material.roughness = 0.3;
                    console.log("Applied carbon fiber material");
                  } else {
                    // Default neutral gray for other parts
                    material.color.setHex(0x7d7d7d); // Neutral gray
                    material.metalness = 0.5;
                    material.roughness = 0.4;
                    console.log("Applied default neutral gray material");
                  }

                  // Ensure material updates
                  material.needsUpdate = true;
                  child.material = material;

                  // Enable shadows
                  child.castShadow = true;
                  child.receiveShadow = true;
                } catch (materialError) {
                  console.warn(
                    "Material processing error, using fallback:",
                    materialError
                  );
                  // Create a simple fallback material
                  child.material = new MeshStandardMaterial({
                    color: 0x7d7d7d, // Neutral gray
                    roughness: 0.4,
                    metalness: 0.5,
                  });
                }
              }
            });

            // Set model position and add to scene
            model.position.set(0, 0, 0);
            model.scale.set(1, 1, 1);
            scene.add(model);

            // Set the model reference
            bikeModelRef.current = model;
            console.log("Model added to scene successfully");

            // Center the model
            const box = new Box3().setFromObject(model);
            const center = box.getCenter(new Vector3());
            model.position.sub(center);

            // Position slightly above ground
            model.position.y = 0.3;

            // Set ideal viewing angle
            model.rotation.y = Math.PI * 0.15;
            model.scale.set(1.5, 1.5, 1.5); // Reduced scale to make the bike appear smaller

            // Update loading state
            setModelLoaded(true);
            setLoading(false);
          } catch (error) {
            console.error("Error processing motorcycle model:", error);
            setError(`Error processing model: ${error.message}`);
            setLoading(false);

            // Create a fallback model
            createFallbackModel(scene);
          }
        },
        (progress: any) => {
          console.log(
            `Motorcycle model loading progress: ${
              (progress.loaded / progress.total) * 100
            }%`
          );
        },
        (error: any) => {
          console.error("Error loading motorcycle model:", error);
          setError(`Error loading model: ${error.message}`);
          setLoading(false);

          // Create a fallback model
          createFallbackModel(scene);
        }
      );
    } catch (error) {
      console.error("Error in motorcycle model load:", error);
      setError(`Error in model load: ${error.message}`);
      setLoading(false);
    }
  };

  // Create a simple fallback model if the GLTF model fails to load
  const createFallbackModel = (scene: Scene) => {
    console.log("Creating fallback model");

    // Create a group to hold the motorcycle parts
    const fallbackModel = new Group();

    // Create a simple motorcycle shape with basic geometries
    // Body
    const body = new Mesh(new BoxGeometry(2, 0.4, 0.7));
    body.position.set(0, 0.5, 0);

    // Seat
    const seat = new Mesh(
      new BoxGeometry(1, 0.2, 0.5),
      new MeshStandardMaterial({ color: 0x222222 }) // Black seat
    );
    seat.position.set(-0.2, 0.7, 0);

    // Front wheel
    const frontWheel = new Mesh(
      new BoxGeometry(0.1, 0.6, 0.6),
      new MeshStandardMaterial({ color: 0x111111 })
    );
    frontWheel.position.set(1.1, 0.3, 0);

    // Rear wheel
    const rearWheel = new Mesh(
      new BoxGeometry(0.1, 0.6, 0.6),
      new MeshStandardMaterial({ color: 0x111111 })
    );
    rearWheel.position.set(-1.1, 0.3, 0);

    // Add all parts to group
    fallbackModel.add(body);
    fallbackModel.add(seat);
    fallbackModel.add(frontWheel);
    fallbackModel.add(rearWheel);

    // Set the model reference and add to scene
    fallbackModel.position.set(1.0, 0, 0); // Position to match the actual model
    fallbackModel.rotation.y = Math.PI * 0.25; // Same angle as in GLTF loading
    fallbackModel.scale.set(1.5, 1.5, 1.5); // Make the fallback model larger

    scene.add(fallbackModel);
    bikeModelRef.current = fallbackModel;

    console.log("Fallback model created and added to scene");
  };

  return (
    <View
      style={{
        width,
        height,
        backgroundColor: "transparent",
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible", // Allows model to overflow its container if needed
      }}
    >
      <GLView
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "transparent",
        }}
        onContextCreate={onContextCreate}
        {...panResponder.panHandlers}
      />

      {loading && (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.7)",
            },
          ]}
        >
          <Text
            style={{
              color: "white",
              textAlign: "center",
              fontWeight: "bold",
              fontSize: 16,
            }}
          >
            Loading 3D Model...
          </Text>
        </View>
      )}

      {error && (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "rgba(255,0,0,0.3)",
              padding: 20,
            },
          ]}
        >
          <Text
            style={{
              color: "white",
              textAlign: "center",
              fontWeight: "bold",
              fontSize: 14,
            }}
          >
            Error: {error}
          </Text>
        </View>
      )}
    </View>
  );
}
