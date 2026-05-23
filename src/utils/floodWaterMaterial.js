import { Material, Color } from 'cesium'

let floodPhysicsMaterialRegistered = false

const registerFloodPhysicsMaterial = () => {
  if (floodPhysicsMaterialRegistered) return
  floodPhysicsMaterialRegistered = true

  Material._materialCache.addMaterial('FloodPhysicsWater', {
    fabric: {
      type: 'FloodPhysicsWater',
      uniforms: {
        waterColor: new Color(0.55, 0.82, 0.96, 0.62),
        depthColor: new Color(0.35, 0.68, 0.88, 0.72),
        sunGlintColor: new Color(1.0, 1.0, 0.97, 1.0),
        skyMirrorColor: new Color(0.82, 0.93, 1.0, 1.0),
        reflectivity: 0.72,
        broadPower: 22.0,
        crestPower: 72.0,
        finePower: 140.0,
        glintStrength: 1.0,
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

          vec3 skyBlue = mix(depthColor.rgb, waterColor.rgb, 0.5 + ndv * 0.3);

          // 하늘 거울 반사
          vec3 reflectDir = reflect(-viewDir, normal);
          float skyMirror = pow(max(reflectDir.z, 0.0), 1.2);
          vec3 reflected = mix(skyBlue, skyMirrorColor.rgb, (fresnel + skyMirror * 0.35) * reflectivity);
          material.diffuse = reflected;

          // 3단계 태양 반사: 넓은 햇빛 + 파도 crest + 미세 glint
          float broad = pow(max(dot(normal, halfDir), 0.0), broadPower);
          float crest = pow(max(dot(normal, halfDir), 0.0), crestPower);

          vec2 micro = materialInput.st * 260.0;
          float rippleX = sin(micro.x * 2.8 + micro.y * 1.9) * 0.14;
          float rippleY = sin(micro.x * 1.7 - micro.y * 3.2) * 0.14;
          vec3 glintNormal = normalize(normal + vec3(rippleX, rippleY, 0.0));
          float fine = pow(max(dot(glintNormal, halfDir), 0.0), finePower);

          float glint = broad * 0.45 + crest * 0.85 + fine * 1.25;
          material.diffuse += sunGlintColor.rgb * glint * glintStrength;

          material.alpha = mix(depthColor.a, waterColor.a, 0.45 + fresnel * 0.25);
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
        waterColor: options.waterColor ?? Color.fromBytes(140, 210, 245, 155),
        depthColor: options.depthColor ?? Color.fromBytes(90, 175, 225, 175),
        sunGlintColor: options.sunGlintColor ?? Color.fromBytes(255, 255, 248, 255),
        skyMirrorColor: options.skyMirrorColor ?? Color.fromBytes(210, 235, 255, 255),
        reflectivity: options.reflectivity ?? 0.72,
        broadPower: options.broadPower ?? 22,
        crestPower: options.crestPower ?? 72,
        finePower: options.finePower ?? 140,
        glintStrength: options.glintStrength ?? 1.0,
      },
    },
  })
}

export function createFloodSurfaceMaterial() {
  return createFloodPhysicsMaterial({
    waterColor: Color.fromBytes(150, 215, 250, 145),
    depthColor: Color.fromBytes(100, 185, 235, 170),
    reflectivity: 0.82,
    broadPower: 20,
    crestPower: 64,
    finePower: 130,
    glintStrength: 1.35,
  })
}

export function createFloodBodyMaterialFromShader() {
  return createFloodPhysicsMaterial({
    waterColor: Color.fromBytes(120, 195, 235, 75),
    depthColor: Color.fromBytes(80, 165, 215, 95),
    reflectivity: 0.2,
    glintStrength: 0.1,
  })
}
