# VCPToolBox AI 生图提示词库

**版本**: 1.0.0  
**创建日期**: 2026-04-15  
**最后更新**: 2026-04-15

---

## 一、提示词结构标准

### 通用结构
```
[主体描述] + [细节特征] + [环境/背景] + [光影/色彩] + [构图/视角] + [质量词]
```

### 示例模板
```
(主体) 1girl, long flowing hair, detailed facial features
(服装) wearing summer dress, floral pattern
(环境) beach sunset, ocean waves background
(光影) golden hour lighting, soft shadows, warm tones
(构图) medium shot, rule of thirds, depth of field
(质量) masterpiece, best quality, highly detailed, 8k
```

---

## 二、质量增强词库

### 通用质量词（优先级 P0）
```
masterpiece, best quality, ultra-detailed, 8k, highres, sharp focus, professional, photorealistic
```

### 质量词分级

| 等级 | 质量词 | 使用场景 |
|------|-------|---------|
| 基础 | `masterpiece, best quality` | 所有生成 |
| 增强 | `ultra-detailed, 8k, highres` | 需要高精度 |
| 专业 | `photorealistic, professional, sharp focus` | 写实人像 |
| 艺术 | `artistic, cinematic lighting, dramatic` | 创意场景 |

### 负面提示词（Negative Prompt）
```
# 通用负面词
(worst quality, low quality, normal quality:1.7), lowres, blurry, distorted, out of focus, 3d, cartoon, anime, sketch, greyscale

# 人像负面词
ugly, deformed, noisy, disfigured, bad anatomy, extra limbs, missing fingers, extra digits, poorly drawn hands, poorly drawn face, mutation

# 电商负面词
watermark, text, signature, logo, brand name, copyright
```

---

## 三、服装电商提示词库

### 女装 - 上衣
```
# 平铺→模特转换
professional model wearing {服装类型}, studio lighting, clean background, full body shot, fashion photography, commercial grade, detailed fabric texture

# 场景化穿搭
fashion model wearing {服装类型}, street snap, urban background, natural lighting, candid pose, lifestyle photography
```

### 女装 - 裙装
```
# 连衣裙
elegant dress, flowing fabric, summer style, floral pattern, outdoor garden, soft sunlight, romantic atmosphere, medium shot

# 职业装
professional attire, business suit, office environment, clean lines, corporate photography, neutral background
```

### 男装
```
# 休闲装
casual wear, male model, street style, urban background, natural pose, lifestyle photography, detailed texture

# 商务装
formal suit, business attire, studio lighting, professional headshot, clean background, corporate catalog
```

### 童装
```
# 儿童服装
children clothing, playful pose, bright colors, park background, natural lighting, cheerful atmosphere, safe and cute
```

---

## 四、人像写真提示词库

### 亚洲女性人像
```
# 清新风格
beautiful asian woman, natural makeup, soft smile, daylight, park background, shallow depth of field, portrait photography, skin retouching

# 职业形象
professional headshot, business attire, studio lighting, neutral expression, clean background, corporate portrait

# 艺术写真
artistic portrait, dramatic lighting, creative composition, moody atmosphere, fine art photography, detailed facial features
```

### 男性人像
```
# 商务形象
male professional, business suit, confident expression, office background, corporate headshot, clean lighting

# 人像写真
male portrait, natural lighting, urban background, casual attire, lifestyle photography, detailed facial features
```

### 情侣写真
```
couple portrait, romantic atmosphere, sunset beach, holding hands, intimate pose, golden hour lighting, dreamy background, soft focus
```

---

## 五、营销海报提示词库

### 电商促销
```
promotional banner, sale event, discount badge, clean layout, commercial design, high contrast, eye catching, professional graphic design
```

### 产品展示
```
product showcase, white background, studio lighting, commercial photography, detailed texture, catalog style, professional
```

### 品牌宣传
```
brand campaign, lifestyle imagery, aspirational content, premium quality, cinematic lighting, high-end aesthetic
```

---

## 六、二次元提示词库

### 日系动漫
```
anime style, cel shading, vibrant colors, detailed eyes, dynamic pose, character design, illustration, high quality anime art
```

### 游戏原画
```
game art, character concept, fantasy style, detailed armor, dynamic lighting, digital painting, concept art, high detail
```

### Q 版角色
```
chibi style, cute character, simplified proportions, big eyes, kawaii, sticker art, clean lines, flat colors
```

---

## 七、场景/环境提示词库

### 室内场景
```
# 咖啡厅
cozy cafe interior, warm lighting, wooden furniture, coffee shop ambiance, shallow depth of field

# 办公室
modern office space, clean design, professional environment, natural lighting, minimalist aesthetic

# 居家
cozy living room, home interior, comfortable furniture, warm atmosphere, lifestyle photography
```

### 室外场景
```
# 城市街景
urban street, city background, modern architecture, busy street, lifestyle photography, natural lighting

# 自然风光
nature landscape, mountain view, forest path, natural lighting, scenic background, outdoor photography

# 海滩
beach sunset, ocean waves, sandy shore, golden hour, tropical paradise, vacation vibe
```

---

## 八、光影/色彩提示词库

### 光影效果
```
# 自然光
natural lighting, soft shadows, golden hour, daylight, overcast, diffused light

# 人造光
studio lighting, softbox, ring light, dramatic lighting, rim light, backlight

# 特殊光
volumetric lighting, god rays, lens flare, bokeh, cinematic lighting
```

### 色彩风格
```
# 暖色调
warm tones, golden hour, sunset colors, cozy atmosphere, amber glow

# 冷色调
cool tones, blue hour, moody atmosphere, cinematic grade, teal and orange

# 黑白
black and white, monochrome, high contrast, dramatic lighting, film noir
```

---

## 九、构图/视角提示词库

```
# 景别
extreme close-up, close-up, medium shot, full body shot, wide shot, establishing shot

# 视角
low angle, high angle, eye level, dutch angle, bird's eye view, worm's eye view

# 构图
rule of thirds, centered, leading lines, symmetry, frame within frame, negative space

# 焦距
shallow depth of field, deep focus, bokeh background, telephoto compression, wide angle
```

---

## 十、提示词模板变量

### 可替换变量
| 变量 | 说明 | 示例值 |
|------|------|-------|
| `{服装类型}` | 服装品类 | 连衣裙/衬衫/外套 |
| `{颜色}` | 主色调 | 黑色/白色/印花 |
| `{材质}` | 面料质感 | 棉质/丝绸/牛仔 |
| `{场景}` | 环境背景 | 咖啡厅/街头/办公室 |
| `{模特类型}` | 人像分类 | 亚洲女性/男性/儿童 |
| `{光影}` | 光线条件 | 自然光/影棚光/黄金时刻 |
| `{构图}` | 镜头语言 | 近景/中景/全景 |

---

## 十一、提示词示例集合

### 电商示例 1：女装连衣裙
```
正面提示词:
professional model wearing elegant floral dress, standing pose, studio lighting, clean white background, full body shot, fashion photography, commercial grade, detailed fabric texture, masterpiece, best quality, 8k

负面提示词:
(worst quality, low quality, normal quality:1.7), watermark, text, signature, deformed, bad anatomy
```

### 电商示例 2：男装夹克
```
正面提示词:
male model wearing casual denim jacket, urban street background, natural lighting, medium shot, lifestyle photography, detailed texture, professional, photorealistic

负面提示词:
(worst quality, low quality:1.4), 3d, cartoon, anime, sketch, deformed
```

### 人像示例：亚洲女性写真
```
正面提示词:
beautiful asian woman, long black hair, natural makeup, soft smile, white dress, park background, daylight, shallow depth of field, portrait photography, skin retouching, masterpiece, best quality

负面提示词:
ugly, deformed, noisy, blurry, bad anatomy, extra limbs, poorly drawn face
```

---

## 十二、提示词优化技巧

### 1. 权重控制
```
# 强调 (增加权重)
(masterpiece:1.3), (best quality:1.2)

# 减弱 (降低权重)
(simple background:0.8)

# 组合权重
(1girl, long hair:1.2), (blue eyes:1.1)
```

### 2. 顺序优先级
- 重要内容放在提示词前面
- 模型对前面的词权重更高

### 3. 数量控制
- 主体数量用数字明确：`1girl`, `2boys`, `3 apples`
- 避免模糊描述

### 4. 避免冲突
- 不要同时使用矛盾的描述
- 如 `daylight` 和 `night scene`

---

## 十三、参考资源

- **PromptBase**: https://promptbase.com/
- **CivitAI**: https://civitai.com/articles/prompting-guide
- **Danbooru Tags**: https://danbooru.donmai.us/tags
- **PromptHero**: https://prompthero.com/
