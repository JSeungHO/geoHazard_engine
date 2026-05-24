import { Material, Color, Cartesian2 } from 'cesium'

let floodPhysicsMaterialRegistered = false
let tsunamiSurgeMaterialRegistered = false

const registerFloodPhysicsMaterial = () => {
  if (floodPhysicsMaterialRegistered) return
  floodPhysicsMaterialRegistered = true

  Material._materialCache.addMaterial('FloodPhysicsWater', {
    fabric: {
      type: 'FloodPhysicsWater',
      uniforms: {
        waterColor: new Color(0.42, 0.38, 0.30, 0.82),
        depthColor: new Color(0.26, 0.22, 0.18, 0.88),
        sunGlintColor: new Color(0.95, 0.90, 0.78, 1.0),
        skyMirrorColor: new Color(0.62, 0.68, 0.72, 1.0),
        reflectivity: 0.48,
        broadPower: 20.0,
        crestPower: 58.0,
        finePower: 96.0,
        glintStrength: 0.78,
      },
      source: `
        uniform vec4 waterColor;
        uniform vec4 depthColor;
        uniform vec4 sunGlintColor;
        uniform vec4 skyMirrorColor;
        uniform float reflectivity;
        uniform float broadPower;
        uniform float crestPower;
        uniform float finePower;
        uniform float glintStrength;

        czm_material czm_getMaterial(czm_materialInput materialInput)
        {
          czm_material material = czm_getDefaultMaterial(materialInput);

          vec3 normal = normalize(material.normal);
          vec3 viewDir = normalize(materialInput.positionToEyeEC);
          vec3 lightDir = normalize(czm_sunDirectionEC);
          vec3 halfDir = normalize(lightDir + viewDir);

          float ndv = max(dot(normal, viewDir), 0.0);
          float fresnel = pow(1.0 - ndv, 3.0);

          vec3 skyBlue = mix(depthColor.rgb, waterColor.rgb, 0.55 + ndv * 0.15);

          // 탁수: 하늘·태양 반사는 약하지만 grazing 각도에서 은은히 보임
          vec3 reflectDir = reflect(-viewDir, normal);
          float skyMirror = pow(max(reflectDir.z, 0.0), 1.4);
          float skyMix = (fresnel * 0.48 + skyMirror * 0.22) * reflectivity;
          vec3 reflected = mix(skyBlue, skyMirrorColor.rgb, skyMix);
          material.diffuse = reflected;

          // 3단계 태양 반사: 넓은 햇빛 + 파도 crest + 미세 glint
          float broad = pow(max(dot(normal, halfDir), 0.0), broadPower);
          float crest = pow(max(dot(normal, halfDir), 0.0), crestPower);

          vec2 micro = materialInput.positionToEyeEC.xy * 0.014;
          float rippleX = sin(micro.x * 2.8 + micro.y * 1.9) * 0.14;
          float rippleY = sin(micro.x * 1.7 - micro.y * 3.2) * 0.14;
          vec3 glintNormal = normalize(normal + vec3(rippleX, rippleY, 0.0));
          float fine = pow(max(dot(glintNormal, halfDir), 0.0), finePower);

          float glint = broad * 0.38 + crest * 0.72 + fine * 0.95;
          material.diffuse += sunGlintColor.rgb * glint * glintStrength;

          // 수면 rim sheen (탁수 표면 광택)
          material.diffuse += sunGlintColor.rgb * fresnel * 0.12 * glintStrength;

          material.alpha = mix(depthColor.a, waterColor.a, 0.55 + fresnel * 0.08);
          material.specular = 1.0;
          material.shininess = crestPower;

          return material;
        }
      `,
    },
  })
}

export function createFloodPhysicsMaterial(options = {}) {
  registerFloodPhysicsMaterial()
  return new Material({
    fabric: {
      type: 'FloodPhysicsWater',
      uniforms: {
        waterColor: options.waterColor ?? Color.fromBytes(102, 92, 72, 210),
        depthColor: options.depthColor ?? Color.fromBytes(62, 54, 44, 225),
        sunGlintColor: options.sunGlintColor ?? Color.fromBytes(242, 230, 200, 255),
        skyMirrorColor: options.skyMirrorColor ?? Color.fromBytes(158, 172, 184, 255),
        reflectivity: options.reflectivity ?? 0.48,
        broadPower: options.broadPower ?? 20,
        crestPower: options.crestPower ?? 58,
        finePower: options.finePower ?? 96,
        glintStrength: options.glintStrength ?? 0.78,
      },
    },
  })
}

export function createFloodSurfaceMaterial() {
  return createFloodPhysicsMaterial({
    waterColor: Color.fromBytes(102, 92, 72, 210),
    depthColor: Color.fromBytes(62, 54, 44, 225),
    sunGlintColor: Color.fromBytes(242, 230, 200, 255),
    skyMirrorColor: Color.fromBytes(158, 172, 184, 255),
    reflectivity: 0.48,
    broadPower: 20,
    crestPower: 58,
    finePower: 96,
    glintStrength: 0.78,
  })
}

export function createFloodBodyMaterialFromShader() {
  return createFloodPhysicsMaterial({
    waterColor: Color.fromBytes(82, 74, 58, 145),
    depthColor: Color.fromBytes(48, 42, 34, 165),
    sunGlintColor: Color.fromBytes(200, 190, 165, 255),
    skyMirrorColor: Color.fromBytes(130, 140, 148, 255),
    reflectivity: 0.22,
    glintStrength: 0.12,
  })
}

/** 쓰나미용 연안 수면 — 위성 바다 톤에 맞춘 저채도 청록, 반투명 */
export function createTsunamiSurfaceMaterial() {
  return createFloodPhysicsMaterial({
    waterColor:     Color.fromBytes(52, 92, 98, 158),
    depthColor:     Color.fromBytes(30, 58, 68, 178),
    sunGlintColor:  Color.fromBytes(218, 232, 228, 255),
    skyMirrorColor: Color.fromBytes(88, 118, 128, 255),
    reflectivity:   0.36,
    glintStrength:  0.48,
    broadPower:     22,
    crestPower:     54,
    finePower:      90,
  })
}

/** 쓰나미용 연안 수체 — 수면보다 어둡고 투명해 지형·바다 imagery와 섞임 */
export function createTsunamiBodyMaterial() {
  return createFloodPhysicsMaterial({
    waterColor:     Color.fromBytes(38, 72, 78, 88),
    depthColor:     Color.fromBytes(22, 48, 56, 108),
    sunGlintColor:  Color.fromBytes(190, 210, 205, 255),
    skyMirrorColor: Color.fromBytes(72, 98, 108, 255),
    reflectivity:   0.16,
    glintStrength:  0.07,
  })
}

const registerTsunamiSurgeMaterial = () => {
  if (tsunamiSurgeMaterialRegistered) return
  tsunamiSurgeMaterialRegistered = true

  Material._materialCache.addMaterial('TsunamiSurgeMaterial', {
    fabric: {
      type: 'TsunamiSurgeMaterial',
      uniforms: {
        baseColor: new Color(0.15, 0.38, 0.42, 0.55),
        foamColor: new Color(0.86, 0.94, 0.96, 0.88),
        seaUV: new Cartesian2(0.2, 0.5),
        inlandUV: new Cartesian2(0.8, 0.5),
        progress: 1.0,
        crossRadius: 0.4,
        feather: 0.06,
        foamWidth: 0.055,
        depthFade: 0.55,
      },
      source: `
        uniform vec4 baseColor;
        uniform vec4 foamColor;
        uniform vec2 seaUV;
        uniform vec2 inlandUV;
        uniform float progress;
        uniform float crossRadius;
        uniform float feather;
        uniform float foamWidth;
        uniform float depthFade;

        czm_material czm_getMaterial(czm_materialInput materialInput)
        {
          czm_material material = czm_getDefaultMaterial(materialInput);
          vec2 st = materialInput.st;

          vec2 axis = inlandUV - seaUV;
          float axisLen = length(axis);
          vec2 axisNorm = axis / max(axisLen, 0.0001);
          vec2 rel = st - seaUV;
          float along = dot(rel, axisNorm);
          float perp = abs(rel.x * (-axisNorm.y) + rel.y * axisNorm.x);

          float front = axisLen * progress;
          float crossLimit = crossRadius + feather * 0.5;

          float weightAlongBack = smoothstep(-feather, feather * 0.35, along);
          float weightAlongFront = 1.0 - smoothstep(front - feather, front + feather * 0.35, along);
          float weightCross = 1.0 - smoothstep(crossRadius - feather, crossLimit, perp);
          float finalWeight = weightAlongBack * weightAlongFront * weightCross;

          float depthT = clamp(along / max(front, 0.001), 0.0, 1.0);
          float depthAlpha = 1.0 - depthT * depthFade;

          float foamT = 1.0 - smoothstep(front - foamWidth, front, along);
          float foamMix = foamT * weightCross;

          vec3 color = mix(baseColor.rgb, foamColor.rgb, foamMix * min(foamColor.a, 1.0));
          float alpha = baseColor.a * finalWeight * depthAlpha + foamColor.a * foamMix * 0.55;

          material.diffuse = color;
          material.alpha = clamp(alpha, 0.0, 1.0);
          material.emission = foamColor.rgb * foamMix * 0.42;
          material.specular = 0.35 + foamMix * 0.45;
          material.shininess = 28.0;
          return material;
        }
      `,
    },
  })
}

/**
 * @param {{ seaU: number, seaV: number, inlandU: number, inlandV: number, progress?: number, crossRadius?: number, feather?: number }} surgeMask
 * @param {number} [waveHeightM]
 * @param {{ isWall?: boolean, reached?: boolean }} [opts]
 */
export function createTsunamiSurgeMaterial(surgeMask, waveHeightM = 5, opts = {}) {
  registerTsunamiSurgeMaterial()

  const { isWall = false, reached = false } = opts
  const alpha = isWall
    ? Math.min(0.78 + waveHeightM / 14, 0.96)
    : Math.min(0.65 + waveHeightM / 16, 0.88)

  return new Material({
    fabric: {
      type: 'TsunamiSurgeMaterial',
      uniforms: {
        baseColor: Color.fromBytes(isWall ? 22 : 38, isWall ? 72 : 98, isWall ? 88 : 108, Math.round(alpha * 255)),
        foamColor: Color.fromBytes(245, 252, 255, isWall ? 245 : 225),
        seaUV: new Cartesian2(surgeMask.seaU, surgeMask.seaV),
        inlandUV: new Cartesian2(surgeMask.inlandU, surgeMask.inlandV),
        progress: surgeMask.progress ?? 1,
        crossRadius: surgeMask.crossRadius ?? 0.4,
        feather: surgeMask.feather ?? 0.06,
        foamWidth: reached ? 0.09 : 0.075,
        depthFade: isWall ? 0.28 : 0.45,
      },
    },
  })
}
