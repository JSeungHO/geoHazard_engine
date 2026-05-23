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

          vec2 micro = materialInput.st * 260.0;
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
