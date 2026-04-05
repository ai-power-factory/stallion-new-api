/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Button, Input, Typography } from '@douyinfe/semi-ui';
import {
  API,
  copy,
  getSystemName,
  showError,
  showSuccess,
} from '../../helpers';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { API_ENDPOINTS } from '../../constants/common.constant';
import { StatusContext } from '../../context/Status';
import { useActualTheme } from '../../context/Theme';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import {
  IconCopy,
  IconFile,
  IconGithubLogo,
  IconPlay,
} from '@douyinfe/semi-icons';
import { Link } from 'react-router-dom';
import NoticeModal from '../../components/layout/NoticeModal';
import {
  ArrowRight,
  BadgeCheck,
  Blocks,
  Gauge,
  Globe2,
  KeyRound,
  Layers3,
  Network,
  ShieldCheck,
  Users,
  WalletCards,
} from 'lucide-react';
import {
  Moonshot,
  OpenAI,
  XAI,
  Zhipu,
  Volcengine,
  Cohere,
  Claude,
  Gemini,
  Minimax,
  DeepSeek,
  Qwen,
  AzureAI,
} from '@lobehub/icons';

const { Text } = Typography;

const providerLogos = [
  { name: 'OpenAI', icon: <OpenAI size={26} /> },
  { name: 'Claude', icon: <Claude.Color size={26} /> },
  { name: 'Gemini', icon: <Gemini.Color size={26} /> },
  { name: 'Moonshot', icon: <Moonshot size={26} /> },
  { name: 'DeepSeek', icon: <DeepSeek.Color size={26} /> },
  { name: 'Qwen', icon: <Qwen.Color size={26} /> },
  { name: 'Zhipu', icon: <Zhipu.Color size={26} /> },
  { name: 'Volcengine', icon: <Volcengine.Color size={26} /> },
  { name: 'Cohere', icon: <Cohere.Color size={26} /> },
  { name: 'Minimax', icon: <Minimax.Color size={26} /> },
  { name: 'xAI', icon: <XAI size={26} /> },
  { name: 'Azure AI', icon: <AzureAI.Color size={26} /> },
];

const previewEndpoints = API_ENDPOINTS.slice(0, 6);

const SectionHeader = ({ eyebrow, title, description }) => (
  <div className='max-w-3xl'>
    <div className='mb-4 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.32em] text-[#7c3aed]'>
      <div className='home-section-dot' />
      <span>{eyebrow}</span>
      <span className='home-eyebrow-line' />
    </div>
    <h2 className='home-heading text-3xl font-semibold leading-tight text-semi-color-text-0 md:text-4xl'>
      {title}
    </h2>
    {description && (
      <p className='mt-4 text-base leading-7 text-semi-color-text-1 md:text-lg'>
        {description}
      </p>
    )}
  </div>
);

const StepCard = ({ icon: Icon, index, title, description }) => (
  <div className='home-panel rounded-[28px] p-6 md:p-7 group'>
    <div className='mb-8 flex items-center justify-between'>
      <div className='home-card-icon group-hover:scale-110 transition-transform duration-300'>
        <Icon size={20} strokeWidth={2} />
      </div>
      <span className='home-heading text-sm font-semibold tracking-[0.28em] text-[#7c3aed] dark:text-[#a78bfa]'>
        {index}
      </span>
    </div>
    <h3 className='home-heading text-xl font-semibold text-semi-color-text-0'>{title}</h3>
    <p className='mt-3 text-sm leading-7 text-semi-color-text-1 md:text-base'>
      {description}
    </p>
  </div>
);

const FeatureCard = ({ icon: Icon, title, description }) => (
  <div className='home-panel rounded-[26px] p-6 transition-all duration-300 hover:-translate-y-1.5 group'>
    <div className='home-card-icon mb-5 group-hover:scale-110 transition-transform duration-300'>
      <Icon size={20} strokeWidth={2} />
    </div>
    <h3 className='home-heading text-xl font-semibold text-semi-color-text-0'>{title}</h3>
    <p className='mt-3 text-sm leading-7 text-semi-color-text-1 md:text-base'>
      {description}
    </p>
  </div>
);

const HighlightCard = ({ icon: Icon, title, description }) => (
  <div className='home-panel rounded-[26px] p-6 md:p-7 transition-all duration-300 hover:-translate-y-1 group'>
    <div className='flex items-start gap-4'>
      <div className='home-card-icon shrink-0 group-hover:scale-110 transition-transform duration-300'>
        <Icon size={20} strokeWidth={2} />
      </div>
      <div>
        <h3 className='home-heading text-lg font-semibold text-semi-color-text-0 md:text-xl'>
          {title}
        </h3>
        <p className='mt-2 text-sm leading-7 text-semi-color-text-1 md:text-base'>
          {description}
        </p>
      </div>
    </div>
  </div>
);

const Home = () => {
  const { t, i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const actualTheme = useActualTheme();
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const isMobile = useIsMobile();
  const isDemoSiteMode = statusState?.status?.demo_site_enabled || false;
  const docsLink = statusState?.status?.docs_link || '';
  const serverAddress =
    statusState?.status?.server_address || `${window.location.origin}`;
  const systemName = getSystemName();
  const isChinese = i18n.language.startsWith('zh');
  const remainingEndpointCount = Math.max(
    API_ENDPOINTS.length - previewEndpoints.length,
    0,
  );

  const sampleCommand = useMemo(
    () =>
      [
        `curl ${serverAddress}/v1/chat/completions \\`,
        `  -H 'Content-Type: application/json' \\`,
        `  -H 'Authorization: Bearer YOUR_API_KEY' \\`,
        `  -d '{`,
        `    "model": "gpt-4o-mini",`,
        `    "messages": [{"role": "user", "content": "Hello!"}]`,
        `  }'`,
      ].join('\n'),
    [serverAddress],
  );

  const integrationSteps = [
    {
      index: '01',
      icon: KeyRound,
      title: t('创建密钥'),
      description: t(
        '登录控制台后生成 API Key，支持多密钥和独立权限。',
      ),
    },
    {
      index: '02',
      icon: Globe2,
      title: t('替换 Base URL'),
      description: t(
        '保持 OpenAI SDK 调用方式不变，只替换请求入口即可。',
      ),
    },
    {
      index: '03',
      icon: Layers3,
      title: t('选择模型'),
      description: t(
        '通过 model 指定目标模型或渠道策略，按需切换上游。',
      ),
    },
  ];

  const productionFeatures = [
    {
      icon: Blocks,
      title: t('统一协议'),
      description: t(
        '兼容 OpenAI 请求格式，减少迁移和多 SDK 维护成本。',
      ),
    },
    {
      icon: Network,
      title: t('渠道路由'),
      description: t(
        '支持多渠道聚合、故障切换和按策略分发请求。',
      ),
    },
    {
      icon: WalletCards,
      title: t('配额计费'),
      description: t(
        '用户、分组、令牌、额度与消费记录统一管理。',
      ),
    },
    {
      icon: ShieldCheck,
      title: t('安全审计'),
      description: t(
        '登录鉴权、限流、日志和管理员配置集中可控。',
      ),
    },
  ];

  const highlightCards = [
    {
      icon: BadgeCheck,
      title: t('统一入口，降低接入复杂度'),
      description: t(
        '兼容现有 SDK 与调用方式，减少业务改造成本。',
      ),
    },
    {
      icon: Users,
      title: t('把运营与治理前置'),
      description: t(
        '把密钥、额度、分组、计费和日志放进一个后台。',
      ),
    },
    {
      icon: Gauge,
      title: t('对上游保持弹性'),
      description: t(
        '可以按模型、渠道和策略组合转发，降低单点依赖。',
      ),
    },
  ];

  const displayHomePageContent = async () => {
    const cachedContent = localStorage.getItem('home_page_content') || '';
    if (cachedContent) {
      setHomePageContent(cachedContent);
    }

    try {
      const res = await API.get('/api/home_page_content');
      const { success, message, data } = res.data;

      if (!success) {
        if (message) {
          showError(message);
        }
        if (!cachedContent) {
          setHomePageContent('');
        }
        return;
      }

      const rawContent = typeof data === 'string' ? data.trim() : '';

      if (!rawContent) {
        localStorage.removeItem('home_page_content');
        setHomePageContent('');
        return;
      }

      const content = rawContent.startsWith('https://')
        ? rawContent
        : marked.parse(rawContent);

      setHomePageContent(content);
      localStorage.setItem('home_page_content', content);
    } catch (error) {
      if (!cachedContent) {
        setHomePageContent('');
      }
    } finally {
      setHomePageContentLoaded(true);
    }
  };

  const handleCopyBaseURL = async () => {
    const ok = await copy(serverAddress);
    if (ok) {
      showSuccess(t('已复制到剪切板'));
    }
  };

  const handleCopyExample = async () => {
    const ok = await copy(sampleCommand);
    if (ok) {
      showSuccess(t('已复制示例请求'));
    }
  };

  useEffect(() => {
    const checkNoticeAndShow = async () => {
      const lastCloseDate = localStorage.getItem('notice_close_date');
      const today = new Date().toDateString();
      if (lastCloseDate !== today) {
        try {
          const res = await API.get('/api/notice');
          const { success, data } = res.data;
          if (success && data && data.trim() !== '') {
            setNoticeVisible(true);
          }
        } catch (error) {
          console.error('获取公告失败:', error);
        }
      }
    };

    checkNoticeAndShow();
  }, []);

  useEffect(() => {
    displayHomePageContent().then();
  }, []);

  useEffect(() => {
    if (!homePageContent.startsWith('https://')) {
      return;
    }

    const iframe = document.querySelector('iframe');
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ themeMode: actualTheme }, '*');
      iframe.contentWindow.postMessage({ lang: i18n.language }, '*');
    }
  }, [actualTheme, homePageContent, i18n.language]);

  return (
    <div className='w-full overflow-x-hidden'>
      <NoticeModal
        visible={noticeVisible}
        onClose={() => setNoticeVisible(false)}
        isMobile={isMobile}
      />
      {homePageContentLoaded && homePageContent === '' ? (
        <div className='w-full overflow-x-hidden'>
          <section className='home-hero border-b border-semi-color-border'>
            <div className='blur-ball blur-ball-indigo' />
            <div className='blur-ball blur-ball-teal' />
            <div className='relative z-[1] mx-auto max-w-7xl px-4 pb-20 pt-24 md:px-8 md:pb-24 md:pt-28'>
              <div className='grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center'>
                <div>
                  <div className='home-animate-in mb-6 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.32em] text-[#7c3aed]'>
                    <div className='home-section-dot' />
                    <span>{isChinese ? systemName : systemName.toUpperCase()}</span>
                    <span className='home-eyebrow-line' />
                  </div>

                  <h1 className='home-animate-in home-delay-1 home-heading max-w-3xl text-4xl font-bold leading-tight text-semi-color-text-0 md:text-6xl md:leading-[1.08]'>
                    <span>{t('统一接入主流模型，')}</span>
                    <br />
                    <span className='home-gradient-text'>
                      {t('稳定交付生产流量')}
                    </span>
                  </h1>

                  <p className='home-animate-in home-delay-2 mt-6 max-w-2xl text-base leading-8 text-semi-color-text-1 md:text-lg'>
                    {t(
                      '用一个兼容 OpenAI 的入口，统一管理 OpenAI、Claude、Gemini、Azure、Bedrock 等上游渠道，并把鉴权、计费、限流和审计集中到同一处。',
                    )}
                  </p>

                  <div className='home-animate-in home-delay-3 mt-8 flex flex-wrap gap-3'>
                    {[
                      t('40+ 上游渠道'),
                      t('OpenAI 格式兼容'),
                      t('用户与令牌管理'),
                      t('可私有部署'),
                    ].map((label) => (
                      <span key={label} className='home-chip'>
                        {label}
                      </span>
                    ))}
                  </div>

                  <div className='home-animate-in home-delay-4 home-panel mt-8 rounded-[30px] p-4 md:p-5'>
                    <Text className='!text-xs uppercase tracking-[0.28em] !text-semi-color-text-2'>
                      {t('基础地址')}
                    </Text>
                    <div className='mt-3 flex flex-col gap-3 md:flex-row'>
                      <Input
                        readonly
                        value={serverAddress}
                        size={isMobile ? 'default' : 'large'}
                        className='flex-1 !rounded-2xl'
                      />
                      <Button
                        type='primary'
                        theme='solid'
                        size={isMobile ? 'default' : 'large'}
                        icon={<IconCopy />}
                        className='!rounded-2xl'
                        onClick={handleCopyBaseURL}
                      >
                        {t('复制地址')}
                      </Button>
                    </div>
                    <div className='mt-4'>
                      <Text className='!text-xs uppercase tracking-[0.28em] !text-semi-color-text-2'>
                        {t('当前兼容端点')}
                      </Text>
                      <div className='mt-3 flex flex-wrap gap-2'>
                        {previewEndpoints.map((endpoint) => (
                          <span key={endpoint} className='home-chip-muted'>
                            {endpoint}
                          </span>
                        ))}
                        {remainingEndpointCount > 0 && (
                          <span className='home-chip-muted'>
                            +{remainingEndpointCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className='home-animate-in home-delay-5 mt-8 flex flex-wrap gap-3'>
                    <Link to='/console'>
                      <Button
                        theme='solid'
                        type='primary'
                        size={isMobile ? 'default' : 'large'}
                        className='!rounded-full px-8'
                        icon={<IconPlay />}
                      >
                        {t('获取密钥')}
                      </Button>
                    </Link>
                    {docsLink ? (
                      <Button
                        size={isMobile ? 'default' : 'large'}
                        className='!rounded-full px-7'
                        icon={<IconFile />}
                        onClick={() => window.open(docsLink, '_blank')}
                      >
                        {t('查看文档')}
                      </Button>
                    ) : (
                      isDemoSiteMode &&
                      statusState?.status?.version && (
                        <Button
                          size={isMobile ? 'default' : 'large'}
                          className='!rounded-full px-7'
                          icon={<IconGithubLogo />}
                          onClick={() =>
                            window.open(
                              'https://github.com/QuantumNous/new-api',
                              '_blank',
                            )
                          }
                        >
                          {statusState.status.version}
                        </Button>
                      )
                    )}
                  </div>
                </div>

                <div className='lg:pl-6'>
                  <div className='home-animate-slide home-delay-3 home-terminal overflow-hidden rounded-[32px]'>
                    <div className='flex items-center justify-between border-b border-white/10 px-5 py-4 md:px-6'>
                      <div className='flex items-center gap-2'>
                        <span className='h-3 w-3 rounded-full bg-[#ff5f57]' />
                        <span className='h-3 w-3 rounded-full bg-[#febc2e]' />
                        <span className='h-3 w-3 rounded-full bg-[#28c840]' />
                      </div>
                      <span className='text-xs uppercase tracking-[0.32em] text-slate-400'>
                        Gateway
                      </span>
                    </div>

                    <div className='px-5 py-6 md:px-7 md:py-7'>
                      <div className='mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-400'>
                        <span className='home-terminal-pill'>POST</span>
                        <span>{serverAddress}/v1/chat/completions</span>
                      </div>

                      <pre className='overflow-hidden whitespace-pre-wrap break-all text-sm leading-7 text-slate-100 md:text-[15px]' style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace" }}>
                        {sampleCommand}
                      </pre>

                      <div className='mt-6 grid gap-3 sm:grid-cols-3'>
                        {[
                          t('统一鉴权'),
                          t('计费与额度'),
                          t('路由与容灾'),
                        ].map((item) => (
                          <div
                            key={item}
                            className='rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-200'
                          >
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className='flex flex-col gap-3 border-t border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-7'>
                      <span className='text-sm text-slate-400'>
                        {t('保持 OpenAI 调用格式，直接替换 Base URL 即可。')}
                      </span>
                      <button
                        type='button'
                        className='inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-5 py-2 text-sm font-medium text-white transition hover:bg-white/15'
                        onClick={handleCopyExample}
                      >
                        <IconCopy />
                        <span>{t('复制示例请求')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className='home-section mt-16 md:mt-20' style={{ animationDelay: '0.6s' }}>
                <SectionHeader
                  eyebrow={t('支持的主流供应商')}
                  title={t('一个网关，覆盖文本、视觉、语音与多模态能力。')}
                  description={t(
                    '不需要为每个供应商单独维护接入代码，把模型能力收敛到同一个控制平面。',
                  )}
                />
                <div className='mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5'>
                  {providerLogos.map((provider) => (
                    <div
                      key={provider.name}
                      className='home-panel home-provider-card rounded-2xl px-4 py-4'
                    >
                      <div className='flex items-center gap-3'>
                        <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-white/60 dark:bg-white/5'>
                          {provider.icon}
                        </div>
                        <span className='font-medium text-semi-color-text-0'>
                          {provider.name}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className='home-panel rounded-2xl px-4 py-4'>
                    <div className='flex h-full flex-col justify-center'>
                      <span className='text-3xl font-semibold text-[#7c4dff]'>
                        40+
                      </span>
                      <span className='mt-2 text-sm text-semi-color-text-1'>
                        {t('主流模型与渠道持续扩展')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className='mx-auto max-w-7xl px-4 py-20 md:px-8'>
            <SectionHeader
              eyebrow={t('接入方式')}
              title={t('三步完成接入')}
              description={t(
                '几乎不改业务代码，把模型接入切换成标准化基础设施。',
              )}
            />
            <div className='mt-10 grid gap-4 lg:grid-cols-3'>
              {integrationSteps.map((step, i) => (
                <div key={step.index} className='home-animate-in' style={{ animationDelay: `${i * 0.1}s` }}>
                  <StepCard {...step} />
                </div>
              ))}
            </div>
          </section>

          <section className='border-y border-semi-color-border bg-[linear-gradient(180deg,rgba(99,102,241,0.04),transparent)]'>
            <div className='mx-auto max-w-7xl px-4 py-20 md:px-8'>
              <SectionHeader
                eyebrow={t('核心能力')}
                title={t('面向生产环境的能力')}
                description={t(
                  '不只是做协议转发，还把稳定性、治理和可观测性补齐。',
                )}
              />
              <div className='mt-10 grid gap-4 md:grid-cols-2'>
                {productionFeatures.map((feature, i) => (
                  <div key={feature.title} className='home-animate-in' style={{ animationDelay: `${i * 0.08}s` }}>
                    <FeatureCard {...feature} />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className='mx-auto max-w-7xl px-4 py-20 md:px-8'>
            <SectionHeader
              eyebrow={t('团队场景')}
              title={t('为什么团队会选择它')}
              description={t(
                '从个人项目到团队网关，都能在同一套控制面里运行。',
              )}
            />
            <div className='mt-10 grid gap-4 lg:grid-cols-3'>
              {highlightCards.map((item, i) => (
                <div key={item.title} className='home-animate-in' style={{ animationDelay: `${i * 0.1}s` }}>
                  <HighlightCard {...item} />
                </div>
              ))}
            </div>

            <div className='home-panel home-cta-panel mt-12 rounded-[32px] p-8 md:flex md:items-center md:justify-between md:gap-8 md:p-10'>
              <div className='max-w-2xl'>
                <div className='mb-4 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.32em] text-[#7c3aed]'>
                  <div className='home-section-dot' />
                  <span>{t('立即开始')}</span>
                  <span className='home-eyebrow-line' />
                </div>
                <h2 className='home-heading text-3xl font-semibold leading-tight text-semi-color-text-0 md:text-4xl'>
                  {t('准备开始接入了吗？')}
                </h2>
                <p className='mt-4 text-base leading-7 text-semi-color-text-1 md:text-lg'>
                  {t('复制基础地址，5 分钟内跑通第一条请求。')}
                </p>
              </div>

              <div className='mt-8 flex flex-wrap gap-3 md:mt-0 md:justify-end'>
                <Link to='/console'>
                  <Button
                    theme='solid'
                    type='primary'
                    size={isMobile ? 'default' : 'large'}
                    icon={<ArrowRight size={16} />}
                    className='!rounded-full px-8'
                  >
                    {t('登录控制台')}
                  </Button>
                </Link>
                <Button
                  size={isMobile ? 'default' : 'large'}
                  className='!rounded-full px-7'
                  icon={<IconCopy />}
                  onClick={handleCopyBaseURL}
                >
                  {t('复制基础地址')}
                </Button>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className='w-full overflow-x-hidden'>
          {homePageContent.startsWith('https://') ? (
            <iframe
              src={homePageContent}
              className='h-screen w-full border-none'
            />
          ) : (
            <div
              className='mt-[60px]'
              dangerouslySetInnerHTML={{ __html: homePageContent }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
