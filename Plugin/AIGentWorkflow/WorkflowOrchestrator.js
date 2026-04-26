/**
 * WorkflowOrchestrator Agent - 工作流编排师
 *
 * 职责:
 * 1. 解析用户自然语言需求
 * 2. 匹配/选择 ComfyUI 工作流模板
 * 3. 填充参数并执行
 * 4. 返回生成结果
 */

const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

class WorkflowOrchestratorAgent {
  constructor(options = {}) {
    this.name = 'WorkflowOrchestratorAgent';
    this.description = 'AI 生图工作流编排师 - 编排 ComfyUI 工作流执行图像生成';

    // 依赖注入
    this.comfyUIGen = options.comfyUIGen;
    this.promptEngineer = options.promptEngineer;

    // 工作流模板库
    this.workflowTemplates = {
      // 电商类
      'ecommerce_model': {
        name: '电商模特图',
        description: '平铺图转模特图，保持服装细节',
        workflow: 'text2img_basic',
        category: 'ecommerce'
      },
      'ecommerce_color_variants': {
        name: '同款多色',
        description: '生成同一款式的多种颜色变体',
        workflow: 'text2img_basic',
        category: 'ecommerce'
      },
      'ecommerce_scene': {
        name: '场景化穿搭',
        description: '服装在特定场景下的展示',
        workflow: 'text2img_basic',
        category: 'ecommerce'
      },

      // 人类
      'portrait_fresh': {
        name: '清新人像',
        description: '清新风格的人像写真',
        workflow: 'text2img_basic',
        category: 'portrait'
      },
      'portrait_professional': {
        name: '职业形象',
        description: '职业形象照/证件照',
        workflow: 'text2img_basic',
        category: 'portrait'
      },
      'portrait_artistic': {
        name: '艺术写真',
        description: '艺术风格的人像摄影',
        workflow: 'text2img_basic',
        category: 'portrait'
      },

      // 营销类
      'marketing_promotion': {
        name: '促销海报',
        description: '电商促销活动海报',
        workflow: 'text2img_basic',
        category: 'marketing'
      },
      'marketing_product': {
        name: '产品展示',
        description: '产品白底图/展示图',
        workflow: 'text2img_basic',
        category: 'marketing'
      },

      // 二次元类
      'anime_character': {
        name: '角色设计',
        description: '二次元角色设计',
        workflow: 'text2img_basic',
        category: 'anime'
      },
      'anime_game_art': {
        name: '游戏原画',
        description: '游戏风格原画',
        workflow: 'text2img_basic',
        category: 'anime'
      }
    };

    // 参数映射表
    this.parameterMapping = {
      // 服装相关
      '连衣裙': { clothing_type: 'dress' },
      '裙装': { clothing_type: 'dress' },
      '衬衫': { clothing_type: 'shirt' },
      '女装': { clothing_type: 'women fashion outfit' },
      '男装': { clothing_type: 'men fashion outfit' },
      '外套': { clothing_type: 'jacket' },
      '裤装': { clothing_type: 'pants' },
      '运动装': { clothing_type: 'sportswear' },
      '泳装': { clothing_type: 'swimsuit' },
      'dress': { clothing_type: 'dress' },
      'shirt': { clothing_type: 'shirt' },
      'jacket': { clothing_type: 'jacket' },
      'pants': { clothing_type: 'pants' },

      // 场景相关
      '纯色': { scene: 'studio' },
      'white background': { scene: 'studio' },
      'studio': { scene: 'studio' },
      '街头': { scene: 'street' },
      '咖啡厅': { scene: 'cafe' },
      '办公室': { scene: 'office' },
      '户外': { scene: 'outdoor' },
      '海滩': { scene: 'beach' },

      // 风格相关
      '清新': { style: 'natural' },
      '职业': { style: 'professional' },
      '艺术': { style: 'artistic' },
      '休闲': { style: 'casual' },
      '商务': { style: 'business' }
    };
  }

  /**
   * 初始化
   */
  async initialize() {
    console.log('[WorkflowOrchestrator] Initializing...');

    // 检查工作流模板目录
    await this._loadWorkflowTemplates();

    return true;
  }

  /**
   * 加载工作流模板
   */
  async _loadWorkflowTemplates() {
    const workflowsDir = path.join(__dirname, '..', 'ComfyUIGen', 'workflows');

    try {
      const files = await fs.readdir(workflowsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      console.log(`[WorkflowOrchestrator] Found ${jsonFiles.length} workflow templates`);

      for (const file of jsonFiles) {
        const templateName = file.replace('.json', '');
        try {
          const template = await fs.readFile(path.join(workflowsDir, file), 'utf-8');
          const workflow = JSON.parse(template);
          console.log(`  - ${templateName}: OK`);
        } catch (e) {
          console.warn(`  - ${templateName}: Failed - ${e.message}`);
        }
      }
    } catch (e) {
      console.warn('[WorkflowOrchestrator] Could not load workflow templates:', e.message);
    }
  }

  /**
   * 执行工作流 - 主入口
   * @param {string} userInput - 用户自然语言输入
   * @param {object} options - 执行选项
   * @returns {Promise<object>} 执行结果
   */
  async execute(userInput, options = {}) {
    try {
      // 1. 需求解析
      console.log('[WorkflowOrchestrator] Parsing request...');
      const requirements = await this.parseRequirements(userInput);
      console.log('Requirements:', requirements);

      // 2. 模板匹配
      console.log('[WorkflowOrchestrator] Matching template...');
      const template = this.matchTemplate(requirements);
      console.log('Matched template:', template);

      if (!template) {
        return {
          success: false,
          error: '未找到匹配的工作流模板',
          requirements: requirements
        };
      }

      // 3. 参数填充
      console.log('[WorkflowOrchestrator] Filling parameters...');
      const workflowParams = this.fillParameters(requirements, template);
      console.log('Parameters:', workflowParams);

      // 4. 执行工作流（如果 ComfyUI 可用）
      if (this.comfyUIGen && typeof this.comfyUIGen.execute === 'function') {
        console.log('[WorkflowOrchestrator] Executing workflow...');
        const result = await this.comfyUIGen.execute(workflowParams);
        return {
          success: true,
          result: result,
          template: template.name,
          requirements: requirements
        };
      }

      // 返回模拟结果（用于测试）
      return {
        success: true,
        simulated: true,
        workflow: template.workflow,
        params: workflowParams,
        template: template.name,
        requirements: requirements
      };

    } catch (error) {
      console.error('[WorkflowOrchestrator] Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 解析需求
   */
  async parseRequirements(userInput) {
    const lowerInput = userInput.toLowerCase();
    const requirements = {
      category: 'general',
      subCategory: '',
      clothing: '',
      scene: '',
      style: '',
      lighting: '',
      composition: '',
      raw: userInput
    };

    // 分类判断
    if (
      lowerInput.includes('电商') ||
      lowerInput.includes('服装') ||
      lowerInput.includes('模特') ||
      lowerInput.includes('ecommerce') ||
      lowerInput.includes('fashion') ||
      lowerInput.includes('model')
    ) {
      requirements.category = 'ecommerce';
    } else if (lowerInput.includes('人像') || lowerInput.includes('写真') || lowerInput.includes('portrait')) {
      requirements.category = 'portrait';
    } else if (
      lowerInput.includes('海报') ||
      lowerInput.includes('促销') ||
      lowerInput.includes('营销') ||
      lowerInput.includes('poster') ||
      lowerInput.includes('promotion') ||
      lowerInput.includes('marketing')
    ) {
      requirements.category = 'marketing';
    } else if (
      lowerInput.includes('动漫') ||
      lowerInput.includes('二次元') ||
      lowerInput.includes('游戏') ||
      lowerInput.includes('anime') ||
      lowerInput.includes('game')
    ) {
      requirements.category = 'anime';
    }

    // 服装类型提取
    for (const [keyword, mapping] of Object.entries(this.parameterMapping)) {
      if (lowerInput.includes(keyword)) {
        if (mapping.clothing_type && !requirements.clothing) {
          requirements.clothing = mapping.clothing_type;
        }
        if (mapping.scene && !requirements.scene) {
          requirements.scene = mapping.scene;
        }
        if (mapping.style && !requirements.style) {
          requirements.style = mapping.style;
        }
      }
    }

    // 场景提取
    if (lowerInput.includes('纯色') || lowerInput.includes('白色背景')) {
      requirements.scene = 'studio';
    } else if (lowerInput.includes('街头') || lowerInput.includes('街道')) {
      requirements.scene = 'street';
    } else if (lowerInput.includes('咖啡厅')) {
      requirements.scene = 'cafe';
    } else if (lowerInput.includes('办公室') || lowerInput.includes('办公')) {
      requirements.scene = 'office';
    } else if (lowerInput.includes('海滩') || lowerInput.includes('海边')) {
      requirements.scene = 'beach';
    }

    // 风格提取
    if (lowerInput.includes('清新')) {
      requirements.style = 'natural';
    } else if (lowerInput.includes('职业') || lowerInput.includes('商务')) {
      requirements.style = 'professional';
    } else if (lowerInput.includes('艺术')) {
      requirements.style = 'artistic';
    } else if (lowerInput.includes('休闲')) {
      requirements.style = 'casual';
    }

    return requirements;
  }

  /**
   * 匹配模板
   */
  matchTemplate(requirements) {
    const { category, subCategory } = requirements;

    // 构建模板名称
    let templateName = '';

    if (category === 'ecommerce') {
      if (requirements.clothing) {
        templateName = 'ecommerce_model';
      } else if (requirements.scene) {
        templateName = 'ecommerce_scene';
      } else {
        templateName = 'ecommerce_model';
      }
    } else if (category === 'portrait') {
      if (requirements.style === 'natural') {
        templateName = 'portrait_fresh';
      } else if (requirements.style === 'professional') {
        templateName = 'portrait_professional';
      } else if (requirements.style === 'artistic') {
        templateName = 'portrait_artistic';
      } else {
        templateName = 'portrait_fresh';
      }
    } else if (category === 'marketing') {
      templateName = 'marketing_promotion';
    } else if (category === 'anime') {
      templateName = 'anime_character';
    }

    return this.workflowTemplates[templateName] || null;
  }

  /**
   * 填充参数
   */
  fillParameters(requirements, template) {
    const params = {
      workflow: template.workflow,
      prompt: this._buildPrompt(requirements),
      negative_prompt: this._buildNegativePrompt(requirements),
      width: 1024,
      height: 1024,
      steps: 30,
      cfg: 7.5,
      seed: -1
    };

    return params;
  }

  /**
   * 构建提示词
   */
  _buildPrompt(requirements) {
    const parts = [];

    // 主体
    if (requirements.category === 'ecommerce') {
      parts.push('professional model');
      if (requirements.clothing) {
        parts.push(`wearing ${requirements.clothing}`);
      }
      parts.push('fashion photography, commercial grade');
    } else if (requirements.category === 'portrait') {
      parts.push('portrait photography');
      if (requirements.style === 'natural') {
        parts.push('natural lighting, fresh style');
      } else if (requirements.style === 'professional') {
        parts.push('professional headshot, corporate style');
      } else if (requirements.style === 'artistic') {
        parts.push('artistic composition, dramatic lighting');
      }
    }

    // 场景
    if (requirements.scene) {
      parts.push(`${requirements.scene} background`);
    }

    // 风格
    if (requirements.style) {
      parts.push(`${requirements.style} style`);
    }

    // 质量词
    parts.push('masterpiece, best quality, ultra-detailed, 8k');

    return parts.join(', ');
  }

  /**
   * 构建负面提示词
   */
  _buildNegativePrompt(requirements) {
    const base = '(worst quality, low quality, normal quality:1.7), lowres, blurry, distorted';

    if (requirements.category === 'ecommerce') {
      return base + ', watermark, text, signature, logo, deformed, bad anatomy';
    } else if (requirements.category === 'portrait') {
      return base + ', ugly, deformed, noisy, disfigured, bad anatomy, extra limbs';
    }

    return base;
  }

  /**
   * 获取所有可用模板
   */
  getAvailableTemplates() {
    return Object.entries(this.workflowTemplates).map(([key, template]) => ({
      key: key,
      name: template.name,
      description: template.description,
      category: template.category
    }));
  }

  /**
   * 获取分类模板
   */
  getTemplatesByCategory(category) {
    const result = {};
    for (const [key, template] of Object.entries(this.workflowTemplates)) {
      if (template.category === category) {
        result[key] = template;
      }
    }
    return result;
  }
}

module.exports = WorkflowOrchestratorAgent;
