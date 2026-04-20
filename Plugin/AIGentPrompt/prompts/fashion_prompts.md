# 服装电商提示词分类库

**版本**: 1.0.0  
**创建日期**: 2026-04-15  
**用途**: 专用于 PromptEngineer Agent RAG 检索

---

## 分类索引

### A. 女装类 (FEMALE)
| 编号 | 名称 | 关键词 |
|------|------|--------|
| F001 | 连衣裙 | dress, elegant, floral, feminine |
| F002 | 衬衫/上衣 | blouse, shirt, casual, professional |
| F003 | 外套 | jacket, coat, blazer, outerwear |
| F004 | 裤装 | pants, jeans, skirt, trousers |
| F005 | 泳装 | swimsuit, bikini, beachwear |
| F006 | 运动装 | sportswear, athletic, yoga, gym |
| F007 | 内衣/家居服 | lingerie, pajamas, loungewear |

### B. 男装类 (MALE)
| 编号 | 名称 | 关键词 |
|------|------|--------|
| M001 | 衬衫 | dress shirt, casual shirt, polo |
| M002 | 外套 | jacket, coat, blazer, suit |
| M003 | 裤装 | pants, jeans, chinos, shorts |
| M004 | 运动装 | sportswear, athletic, gym |
| M005 | 泳装 | swimwear, beach shorts |
| M006 | 商务正装 | suit, formal, business attire |

### C. 童装类 (CHILDREN)
| 编号 | 名称 | 关键词 |
|------|------|--------|
| C001 | 女童 | girl's dress, cute, playful |
| C002 | 男童 | boy's outfit, casual, active |
| C003 | 婴儿 | baby clothes, infant, soft |
| C004 | 校服 | school uniform, student |
| C005 | 运动装 | kids sportswear, active |

### D. 场景类 (SCENE)
| 编号 | 名称 | 关键词 |
|------|------|--------|
| S001 | 纯色背景 | solid color, studio, white background |
| S002 | 街头 | street snap, urban, city |
| S003 | 咖啡厅 | cafe, coffee shop, indoor |
| S004 | 办公室 | office, workplace, corporate |
| S005 | 户外自然 | nature, park, garden, outdoor |
| S006 | 海滩 | beach, ocean, seaside, tropical |
| S007 | 商场 | shopping mall, retail, indoor |
| S008 | 居家 | home, living room, cozy |

### E. 风格类 (STYLE)
| 编号 | 名称 | 关键词 |
|------|------|--------|
| ST001 | 休闲 | casual, everyday, relaxed |
| ST002 | 商务 | business, professional, formal |
| ST003 | 运动 | sporty, athletic, active |
| ST004 | 街头 | street style, urban, trendy |
| ST005 | 优雅 | elegant, graceful, sophisticated |
| ST006 | 可爱 | cute, kawaii, playful |
| ST007 | 性感 | sexy, glamorous, alluring |
| ST008 | 复古 | vintage, retro, classic |
| ST009 | 未来 | futuristic, modern, avant-garde |

### F. 光影类 (LIGHTING)
| 编号 | 名称 | 关键词 |
|------|------|--------|
| L001 | 自然光 | natural lighting, daylight |
| L002 | 黄金时刻 | golden hour, sunset, warm light |
| L003 | 影棚光 | studio lighting, softbox |
| L004 | 逆光 | backlight, rim light |
| L005 | 侧光 | side lighting, dramatic |
| L006 | 柔光 | soft light, diffused, overcast |

### G. 构图类 (COMPOSITION)
| 编号 | 名称 | 关键词 |
|------|------|--------|
| C001 | 特写 | close-up, face focus |
| C002 | 中景 | medium shot, waist up |
| C003 | 全景 | full body, full length |
| C004 | 远景 | wide shot, establishing |
| C005 | 俯拍 | high angle, from above |
| C006 | 仰拍 | low angle, looking up |

---

## 详细提示词库

### F001 - 连衣裙

```json
{
  "category": "F001",
  "name": "连衣裙",
  "base_prompt": "elegant dress, feminine style, detailed fabric texture",
  "variations": {
    "casual": "casual sundress, floral pattern, summer style, outdoor garden, natural lighting",
    "formal": "formal evening gown, elegant silhouette, studio lighting, luxury fabric",
    "business": "professional dress, office attire, clean lines, corporate environment",
    "party": "cocktail dress, party style, glamorous, evening lighting, city nightlife"
  },
  "quality_booster": "masterpiece, best quality, ultra-detailed, 8k, fashion photography",
  "negative": "deformed, bad anatomy, poorly drawn, worst quality, low quality"
}
```

### F002 - 衬衫/上衣

```json
{
  "category": "F002",
  "name": "衬衫/上衣",
  "base_prompt": "stylish blouse, detailed collar, fabric texture",
  "variations": {
    "casual": "casual t-shirt, relaxed fit, everyday style, natural lighting",
    "business": "formal blouse, professional attire, office setting, clean background",
    "elegant": "elegant silk blouse, sophisticated, soft lighting, refined style",
    "trendy": "trendy crop top, modern style, urban background, street fashion"
  },
  "quality_booster": "masterpiece, best quality, detailed texture, professional",
  "negative": "wrinkled, stained, low quality, deformed, bad proportions"
}
```

### M001 - 男装衬衫

```json
{
  "category": "M001",
  "name": "男装衬衫",
  "base_prompt": "men's dress shirt, clean lines, professional style",
  "variations": {
    "formal": "formal dress shirt, business attire, tie optional, office background",
    "casual": "casual button shirt, relaxed fit, weekend style, outdoor setting",
    "polo": "polo shirt, smart casual, golf course, leisure style",
    "linen": "linen shirt, summer style, beach vacation, breathable fabric"
  },
  "quality_booster": "masterpiece, best quality, detailed fabric, menswear photography",
  "negative": "wrinkled, stained, ill-fitting, low quality, deformed"
}
```

### S001 - 纯色背景

```json
{
  "category": "S001",
  "name": "纯色背景",
  "base_prompt": "solid color background, clean, minimal",
  "variations": {
    "white": "pure white background, studio, product photography, e-commerce",
    "gray": "neutral gray background, professional, corporate style",
    "black": "black background, dramatic, high contrast, moody",
    "pastel": "soft pastel background, light pink, mint, or light blue"
  },
  "usage": "电商平铺图转换、产品目录、标准化拍摄",
  "tip": "适合批量生成，保持一致性"
}
```

### S002 - 街头场景

```json
{
  "category": "S002",
  "name": "街头场景",
  "base_prompt": "urban street, city background, modern architecture",
  "variations": {
    "downtown": "downtown street, busy urban, skyscrapers, city life",
    "alley": "narrow alley, artistic, graffiti wall, indie vibe",
    "plaza": "city plaza, open space, modern design, public area",
    "night": "night street, neon lights, urban nightlife, dramatic"
  },
  "quality_booster": "street photography, natural lighting, candid style",
  "tip": "适合街头风格服装、潮牌、休闲装"
}
```

---

## 组合公式

### 电商标准组合
```
{服装基础词} + {风格变体} + {场景} + {光影} + {构图} + {质量词}
```

### 示例组合
```
# 女装连衣裙 + 户外 + 自然光
elegant floral dress (F001) + casual sundress variation + outdoor garden (S005) + natural lighting (L001) + medium shot (C002) + quality booster

# 男装衬衫 + 办公室 + 影棚光
men's dress shirt (M001) + formal variation + office setting (S004) + studio lighting (L003) + medium shot (C002) + quality booster
```

---

## 负面提示词库

### 通用负面
```
(worst quality, low quality, normal quality:1.7), lowres, blurry, distorted, out of focus, 3d, cartoon, anime, sketch, greyscale
```

### 电商专用负面
```
watermark, text, signature, logo, brand name, copyright, tag, price tag
```

### 人像专用负面
```
ugly, deformed, noisy, disfigured, bad anatomy, extra limbs, missing fingers, extra digits, poorly drawn hands, poorly drawn face, mutation, mutated
```

---

## 使用指南

### 1. 根据服装类型选择主分类
- 女装 → F 系列
- 男装 → M 系列
- 童装 → C 系列

### 2. 根据需求选择场景
- 电商目录 → S001 纯色
- 街拍风格 → S002 街头
- 生活方式 → S003 咖啡厅/S008 居家

### 3. 组合公式
```
prompt = base_prompt + variation + scene + lighting + composition + quality
```

### 4. 根据模型调整
- Flux.1: 提示词理解好，可简化
- SDXL: 需要更详细描述
- MJ: 艺术性强，需要精简
