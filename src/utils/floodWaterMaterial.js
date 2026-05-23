import { Material, Color } from 'cesium'

let floodPhysicsMaterialRegistered = false

const registerFloodPhysicsMaterial = () => {
  if (floodPhysicsMaterialRegistered) return
  floodPhysicsMaterialRegistered = true

  Material._materialCache.addMaterial('FloodPhysicsWater', {
    fabric: {
      type: 'FloodPhysicsWater',
      uniforms: {
        waterColor: new Color(0.42, 0.38, 0.30, 0.82),
        depthColor: new Color(0.26, 0.22, 0.18, 0.88),
        sunGlintColor: new Color(0.82, 0.76, 0.64, 1.0),
        skyMirrorColor: new Color(0.48, 0.44, 0.38, 1.0),
        reflectivity: 0.28,
        broadPower: 24.0,
        crestPower: 68.0,
        finePower: 120.0,
        glintStrength: 0.35,
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

          // 하늘 거울 반사 (탁수는 반사 약함)
          vec3 reflectDir = reflect(-viewDir, normal);
          float skyMirror = pow(max(reflectDir.z, 0.0), 1.8);
          vec3 reflected = mix(skyBlue, skyMirrorColor.rgb, (fresnel * 0.28 + skyMirror * 0.06) * reflectivity);
          material.diffuse = reflected;

          // 3단계 태양 반사: 넓은 햇빛 + 파도 crest + 미세 glint
          float broad = pow(max(dot(normal, halfDir), 0.0), broadPower);
          float crest = pow(max(dot(normal, halfDir), 0.0), crestPower);

          vec2 micro = materialInput.st * 260.0;
          float rippleX = sin(micro.x * 2.8 + micro.y * 1.9) * 0.14;
          float rippleY = sin(micro.x * 1.7 - micro.y * 3.2) * 0.14;
          vec3 glintNormal = normalize(normal + vec3(rippleX, rippleY, 0.0));
          float fine = pow(max(dot(glintNormal, halfDir), 0.0), finePower);

          float glint = broad * 0.25 + crest * 0.45 + fine * 0.65;
          material.diffuse += sunGlintColor.rgb * glint * glintStrength;

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
        sunGlintColor: options.sunGlintColor ?? Color.fromBytes(195, 185, 160, 255),
        skyMirrorColor: options.skyMirrorColor ?? Color.fromBytes(110, 105, 95, 255),
        reflectivity: options.reflectivity ?? 0.28,
        broadPower: options.broadPower ?? 24,
        crestPower: options.crestPower ?? 68,
        finePower: options.finePower ?? 120,
        glintStrength: options.glintStrength ?? 0.35,
      },
    },
  })
}

export function createFloodSurfaceMaterial() {
  return createFloodPhysicsMaterial({
    waterColor: Color.fromBytes(102, 92, 72, 210),
    depthColor: Color.fromBytes(62, 54, 44, 225),
    sunGlintColor: Color.fromBytes(195, 185, 160, 255),
    skyMirrorColor: Color.fromBytes(110, 105, 95, 255),
    reflectivity: 0.28,
    broadPower: 24,
    crestPower: 68,
    finePower: 120,
    glintStrength: 0.35,
  })
}

export function createFloodBodyMaterialFromShader() {
  return createFloodPhysicsMaterial({
    waterColor: Color.fromBytes(82, 74, 58, 145),
    depthColor: Color.fromBytes(48, 42, 34, 165),
    sunGlintColor: Color.fromBytes(160, 150, 130, 255),
    skyMirrorColor: Color.fromBytes(90, 85, 75, 255),
    reflectivity: 0.08,
    glintStrength: 0.02,
  })
}
