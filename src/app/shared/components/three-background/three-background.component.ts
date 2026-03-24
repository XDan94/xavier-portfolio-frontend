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

@Component({
  selector: 'app-three-background',
  standalone: true,
  imports: [],
  templateUrl: './three-background.component.html',
  styleUrl: './three-background.component.scss',
})
export class ThreeBackgroundComponent implements AfterViewInit, OnDestroy {
  @ViewChild('sceneContainer', { static: true })
  sceneContainer!: ElementRef<HTMLDivElement>;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private composer!: EffectComposer;
  private animationId = 0;
  private clock = new THREE.Clock();

  private hBlurPass!: ShaderPass;
  private vBlurPass!: ShaderPass;

  private bgCanvas!: HTMLCanvasElement;
  private bgCtx!: CanvasRenderingContext2D;
  private bgTexture!: THREE.CanvasTexture;
  private bgBlobs = [
    { x: 0.25, y: 0.30, vx: 0.0003,  vy: 0.0002,  r: 0.65, color: 'rgba(180, 40, 130, 0.85)' },
    { x: 0.55, y: 0.25, vx: -0.0002, vy: 0.0003,  r: 0.58, color: 'rgba(80,  40, 180, 0.85)' },
    { x: 0.78, y: 0.55, vx: -0.0002, vy: -0.0003, r: 0.60, color: 'rgba(30,  130, 155, 0.80)' },
    { x: 0.20, y: 0.70, vx: 0.0003,  vy: -0.0002, r: 0.52, color: 'rgba(150, 30,  80,  0.80)' },
    { x: 0.60, y: 0.75, vx: -0.0001, vy: -0.0002, r: 0.50, color: 'rgba(50,  100, 170, 0.80)' },
  ];

  ngAfterViewInit(): void {
    this.initScene();
    this.initPostProcessing();
    this.animate();
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
    cancelAnimationFrame(this.animationId);
    this.bgTexture?.dispose();
    this.composer?.dispose();
    this.renderer?.dispose();
    const canvas = this.renderer?.domElement;
    if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
  }

  private initBackground(): void {
    this.bgCanvas = document.createElement('canvas');
    this.bgCanvas.width = 1024;
    this.bgCanvas.height = 1024;
    this.bgCtx = this.bgCanvas.getContext('2d')!;
    this.bgTexture = new THREE.CanvasTexture(this.bgCanvas);
    this.updateBackground();
    this.scene.background = this.bgTexture;
  }

  private updateBackground(): void {
    const ctx = this.bgCtx;
    const w = this.bgCanvas.width;
    const h = this.bgCanvas.height;

    ctx.fillStyle = '#1a1520';
    ctx.fillRect(0, 0, w, h);

    for (const b of this.bgBlobs) {
      b.x += b.vx;
      b.y += b.vy;
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

    this.bgTexture.needsUpdate = true;
  }

  private initScene(): void {
    const container = this.sceneContainer.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 4);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.8;
    container.appendChild(this.renderer.domElement);

    this.initBackground();

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const light1 = new THREE.DirectionalLight(0xff99dd, 1.2);
    light1.position.set(-2, 2, 3);
    this.scene.add(light1);
    const light2 = new THREE.DirectionalLight(0x88ddff, 1.2);
    light2.position.set(2, -1, 3);
    this.scene.add(light2);
  }

  private initPostProcessing(): void {
    const container = this.sceneContainer.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    const blurPasses: [number, number][] = [[40, 40], [32, 32], [24, 24], [16, 16], [10, 10]];
    blurPasses.forEach(([h, v]) => {
      const hBlur = new ShaderPass(HorizontalBlurShader);
      const vBlur = new ShaderPass(VerticalBlurShader);
      hBlur.uniforms['h'].value = (1 / width) * h;
      vBlur.uniforms['v'].value = (1 / height) * v;
      if (h === 40) { this.hBlurPass = hBlur; this.vBlurPass = vBlur; }
      this.composer.addPass(hBlur);
      this.composer.addPass(vBlur);
    });

    this.composer.addPass(new UnrealBloomPass(
      new THREE.Vector2(width, height), 0.25, 0.5, 0.7
    ));
    this.composer.addPass(new OutputPass());
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    const elapsed = this.clock.getElapsedTime();
    this.updateBackground();
    this.camera.position.x = Math.sin(elapsed * 0.12) * 0.15;
    this.camera.position.y = Math.cos(elapsed * 0.1) * 0.08;
    this.camera.lookAt(0, 0, 0);
    this.composer.render();
  };

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
