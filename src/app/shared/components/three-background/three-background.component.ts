import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

@Component({
  selector: 'app-three-background',
  standalone: true,
  imports: [],
  templateUrl: './three-background.component.html',
  styleUrl: './three-background.component.scss',
})

export class ThreeBackgroundComponent implements AfterViewInit, OnDestroy {
  @ViewChild('sceneContainer', {static: true})
  sceneContainer!: ElementRef<HTMLDivElement>;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private model!: THREE.Group;
  private renderer!: THREE.WebGLRenderer;
  private composer!: EffectComposer;

  private animationId = 0;
  private clock = new THREE.Clock();

  private shapes: THREE.Mesh[] = [];

  private animatedMeshes: any[] = [];
  private mixer!: THREE.AnimationMixer;

  private hBlurPass!: ShaderPass;
  private vBlurPass!: ShaderPass;

  // --- Blob background ---
  private bgCanvas!: HTMLCanvasElement;
  private bgCtx!: CanvasRenderingContext2D;
  private bgTexture!: THREE.CanvasTexture;
  private bgBlobs = [
    {x: 0.25, y: 0.30, vx: 0.0003, vy: 0.0002, r: 0.65, color: 'rgba(180,  40, 130, 0.85)'},
    {x: 0.55, y: 0.25, vx: -0.0002, vy: 0.0003, r: 0.58, color: 'rgba( 80,  40, 180, 0.85)'},
    {x: 0.78, y: 0.55, vx: -0.0002, vy: -0.0003, r: 0.60, color: 'rgba( 30, 130, 155, 0.80)'},
    {x: 0.20, y: 0.70, vx: 0.0003, vy: -0.0002, r: 0.52, color: 'rgba(150,  30,  80, 0.80)'},
    {x: 0.60, y: 0.75, vx: -0.0001, vy: -0.0002, r: 0.50, color: 'rgba( 50, 100, 170, 0.80)'},
  ];

  ngAfterViewInit(): void {
    this.initScene();
    this.loadModel();
    this.initPostProcessing();
    this.animate();
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
    cancelAnimationFrame(this.animationId);

    this.shapes.forEach((mesh) => {
      mesh.geometry.dispose();

      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat) => mat.dispose());
      } else {
        mesh.material.dispose();
      }
    });

    this.bgTexture?.dispose();
    this.composer?.dispose();
    this.renderer?.dispose();

    const canvas = this.renderer?.domElement;
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
  }

  private initBackground(): void {
    this.bgCanvas = document.createElement('canvas');
    this.bgCanvas.width = 1024;
    this.bgCanvas.height = 1024;
    this.bgCtx = this.bgCanvas.getContext('2d')!;
    this.bgTexture = new THREE.CanvasTexture(this.bgCanvas);
    // Render once immediately so the scene has a background from the start
    this.updateBackground();
    this.scene.background = this.bgTexture;
  }

  private updateBackground(): void {
    const ctx = this.bgCtx;
    const w = this.bgCanvas.width;
    const h = this.bgCanvas.height;

    // Base color matching the original scene
    ctx.fillStyle = '#1a1520';
    ctx.fillRect(0, 0, w, h);

    for (const b of this.bgBlobs) {
      // Move blob
      b.x += b.vx;
      b.y += b.vy;

      // Bounce on edges
      if (b.x < 0.05 || b.x > 0.95) b.vx *= -1;
      if (b.y < 0.05 || b.y > 0.95) b.vy *= -1;

      const cx = b.x * w;
      const cy = b.y * h;
      const radius = b.r * Math.max(w, h);

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, b.color);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, b.r * w, b.r * h, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tell Three.js the texture changed
    this.bgTexture.needsUpdate = true;
  }

  private initScene(): void {
    const container = this.sceneContainer.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 4);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.8;

    container.appendChild(this.renderer.domElement);

    // Init animated background AFTER scene is created
    this.initBackground();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xff99dd, 1.2);
    directionalLight1.position.set(-2, 2, 3);
    this.scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0x88ddff, 1.2);
    directionalLight2.position.set(2, -1, 3);
    this.scene.add(directionalLight2);
  }

  private createShapes(): void {
    const geometries = [
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.SphereGeometry(0.7, 32, 32),
      new THREE.TorusGeometry(0.6, 0.22, 16, 100),
      new THREE.IcosahedronGeometry(0.8, 0),
      new THREE.ConeGeometry(0.7, 1.4, 32),
    ];

    for (let i = 0; i < geometries.length; i++) {
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(`hsl(${i * 70}, 70%, 65%)`),
        roughness: 0.35,
        metalness: 0.25,
      });

      const mesh = new THREE.Mesh(geometries[i], material);

      mesh.position.x = (i - 2) * 2.1;
      mesh.position.y = (Math.random() - 0.5) * 1.2;
      mesh.position.z = (Math.random() - 0.5) * 2.5;

      this.scene.add(mesh);
      this.shapes.push(mesh);
    }
  }

  private initPostProcessing(): void {
    const container = this.sceneContainer.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.composer = new EffectComposer(this.renderer);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.hBlurPass = new ShaderPass(HorizontalBlurShader);
    this.vBlurPass = new ShaderPass(VerticalBlurShader);

    this.hBlurPass.uniforms['h'].value = (1 / width) * 40.0;
    this.vBlurPass.uniforms['v'].value = (1 / height) * 40.0;

    this.composer.addPass(this.hBlurPass);
    this.composer.addPass(this.vBlurPass);

    const hBlur2 = new ShaderPass(HorizontalBlurShader);
    const vBlur2 = new ShaderPass(VerticalBlurShader);
    hBlur2.uniforms['h'].value = (1 / width) * 32.0;
    vBlur2.uniforms['v'].value = (1 / height) * 32.0;
    this.composer.addPass(hBlur2);
    this.composer.addPass(vBlur2);

    const hBlur3 = new ShaderPass(HorizontalBlurShader);
    const vBlur3 = new ShaderPass(VerticalBlurShader);
    hBlur3.uniforms['h'].value = (1 / width) * 24.0;
    vBlur3.uniforms['v'].value = (1 / height) * 24.0;
    this.composer.addPass(hBlur3);
    this.composer.addPass(vBlur3);

    const hBlur4 = new ShaderPass(HorizontalBlurShader);
    const vBlur4 = new ShaderPass(VerticalBlurShader);
    hBlur4.uniforms['h'].value = (1 / width) * 16.0;
    vBlur4.uniforms['v'].value = (1 / height) * 16.0;
    this.composer.addPass(hBlur4);
    this.composer.addPass(vBlur4);

    const hBlur5 = new ShaderPass(HorizontalBlurShader);
    const vBlur5 = new ShaderPass(VerticalBlurShader);
    hBlur5.uniforms['h'].value = (1 / width) * 10.0;
    vBlur5.uniforms['v'].value = (1 / height) * 10.0;
    this.composer.addPass(hBlur5);
    this.composer.addPass(vBlur5);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.25, // strength  — bloom subtil
      0.5,  // radius
      0.7   // threshold — seuil plus haut, moins de pixels affectés
    );
    this.composer.addPass(bloomPass);

    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    const elapsed = this.clock.getElapsedTime();
    const delta = this.clock.getDelta();

    if (this.mixer) {
      this.mixer.update(delta);
    }

    // Update the blob background every frame
    this.updateBackground();

    this.animatedMeshes.forEach((item) => {
      const {mesh, baseY, offset, speed, amplitude, rotationSpeed} = item;

      mesh.position.y =
        baseY + Math.sin(elapsed * speed + offset) * amplitude;

      mesh.rotation.y += 0.0008 * rotationSpeed;
      mesh.rotation.x += 0.0004 * rotationSpeed;
    });

    if (this.model) {
      this.model.rotation.y += 0.0008;
      this.model.rotation.x = Math.sin(elapsed * 0.15) * 0.05;
    }

    this.camera.position.x = Math.sin(elapsed * 0.12) * 0.15;
    this.camera.position.y = Math.cos(elapsed * 0.1) * 0.08;
    this.camera.lookAt(0, 0, 0);

    this.composer.render();
  };

  private loadModel(): void {
    const loader = new GLTFLoader();

    loader.load('assets/3DShapes.glb', (gltf) => {
      this.model = gltf.scene;
      this.scene.add(this.model);

      const box = new THREE.Box3().setFromObject(this.model);
      const center = box.getCenter(new THREE.Vector3());
      this.model.position.sub(center);

      this.model.scale.set(2.2, 2.2, 2.2);
      this.model.position.y -= 0.2;

      if (gltf.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(this.model);
        gltf.animations.forEach((clip) => {
          this.mixer.clipAction(clip).play();
        });
      }

      this.model.traverse((child: any) => {
        if (child.isMesh) {
          this.animatedMeshes.push({
            mesh: child,
            baseY: child.position.y,
            offset: Math.random() * Math.PI * 2,
            speed: 0.2 + Math.random() * 0.4,
            amplitude: 0.03 + Math.random() * 0.05,
            rotationSpeed: 0.05 + Math.random() * 0.08,
          });

          if (child.material) {
            const palette = [
              '#e646aa', // rose vif
              '#6e46dc', // violet
              '#3cb4c3', // teal
              '#c83c6e', // framboise
              '#5096d2', // bleu
              '#a050e0', // lilas
            ];
            const col = palette[this.animatedMeshes.length % palette.length];

            child.material = new THREE.MeshStandardMaterial({
              color: new THREE.Color(col),
              emissive: new THREE.Color(col),
              emissiveIntensity: 0.4,
              roughness: 0.4,
              metalness: 0.15,
              transparent: true,
              opacity: 0.92,
            });
          }
        }
      });
    });
  }

  private onResize = (): void => {
    const container = this.sceneContainer.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.composer.setSize(width, height);

    if (this.hBlurPass && this.vBlurPass) {
      this.hBlurPass.uniforms['h'].value = (1 / width) * 40.0;
      this.vBlurPass.uniforms['v'].value = (1 / height) * 40.0;
    }
  };
}

