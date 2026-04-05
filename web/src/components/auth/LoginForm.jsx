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
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import {
  API,
  getLogo,
  showError,
  showInfo,
  showSuccess,
  updateAPI,
  setUserData,
} from '../../helpers';
import Turnstile from 'react-turnstile';
import { Button, Checkbox, Form, Modal } from '@douyinfe/semi-ui';
import Text from '@douyinfe/semi-ui/lib/es/typography/text';
import { IconLock, IconMail } from '@douyinfe/semi-icons';
import TwoFAVerification from './TwoFAVerification';
import { useTranslation } from 'react-i18next';

const LoginForm = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [inputs, setInputs] = useState({
    username: '',
    password: '',
  });
  const { username, password } = inputs;
  const [searchParams] = useSearchParams();
  const [, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [showTwoFA, setShowTwoFA] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [hasUserAgreement, setHasUserAgreement] = useState(false);
  const [hasPrivacyPolicy, setHasPrivacyPolicy] = useState(false);

  const logo = getLogo();

  const status = useMemo(() => {
    if (statusState?.status) return statusState.status;
    const savedStatus = localStorage.getItem('status');
    if (!savedStatus) return {};
    try {
      return JSON.parse(savedStatus) || {};
    } catch (err) {
      return {};
    }
  }, [statusState?.status]);

  useEffect(() => {
    const affCode = searchParams.get('aff');
    if (affCode) {
      localStorage.setItem('aff', affCode);
    }
  }, [searchParams]);

  useEffect(() => {
    if (status?.turnstile_check) {
      setTurnstileEnabled(true);
      setTurnstileSiteKey(status.turnstile_site_key);
    } else {
      setTurnstileEnabled(false);
      setTurnstileSiteKey('');
      setTurnstileToken('');
    }

    setHasUserAgreement(status?.user_agreement_enabled || false);
    setHasPrivacyPolicy(status?.privacy_policy_enabled || false);
  }, [status]);

  useEffect(() => {
    if (searchParams.get('expired')) {
      showError(t('未登录或登录已过期，请重新登录'));
    }
  }, [searchParams, t]);

  function handleChange(name, value) {
    setInputs((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event?.preventDefault?.();

    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    if (turnstileEnabled && turnstileToken === '') {
      showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
      return;
    }

    setLoginLoading(true);
    try {
      if (username && password) {
        const res = await API.post(`/api/user/login?turnstile=${turnstileToken}`, {
          username,
          password,
        });
        const { success, message, data } = res.data;
        if (success) {
          if (data && data.require_2fa) {
            setShowTwoFA(true);
            setLoginLoading(false);
            return;
          }

          userDispatch({ type: 'login', payload: data });
          setUserData(data);
          updateAPI();
          showSuccess('登录成功！');
          if (username === 'root' && password === '123456') {
            Modal.error({
              title: '您正在使用默认密码！',
              content: '请立刻修改默认密码！',
              centered: true,
            });
          }
          navigate('/console');
        } else {
          showError(message);
        }
      } else {
        showError('请输入用户名和密码！');
      }
    } catch (error) {
      showError('登录失败，请重试');
    } finally {
      setLoginLoading(false);
    }
  }

  const handleResetPasswordClick = () => {
    setResetPasswordLoading(true);
    navigate('/reset');
    setResetPasswordLoading(false);
  };

  const handle2FASuccess = (data) => {
    userDispatch({ type: 'login', payload: data });
    setUserData(data);
    updateAPI();
    showSuccess('登录成功！');
    navigate('/console');
  };

  const handleBackToLogin = () => {
    setShowTwoFA(false);
    setInputs({ username: '', password: '' });
  };

  return (
    <div className='login-page'>
      <Link to='/' className='login-page__brand' aria-label='返回首页'>
        <img src={logo} alt='Logo' className='login-page__brand-image' />
      </Link>

      <div className='login-page__shell'>
        <div className='login-page__card'>
          <div className='login-page__content'>
            <div className='login-page__header'>
              <h1 className='login-page__title'>{t('登录')}</h1>
            </div>

            <Form className='login-page__form'>
              <div className='login-page__field'>
                <Form.Input
                  field='username'
                  label={t('用户名或邮箱')}
                  placeholder={t('请输入您的用户名或邮箱地址')}
                  name='username'
                  value={username}
                  onChange={(value) => handleChange('username', value)}
                  prefix={<IconMail />}
                />
              </div>

              <div className='login-page__field'>
                <Form.Input
                  field='password'
                  label={t('密码')}
                  placeholder={t('请输入您的密码')}
                  name='password'
                  mode='password'
                  value={password}
                  onChange={(value) => handleChange('password', value)}
                  prefix={<IconLock />}
                />
              </div>

              {(hasUserAgreement || hasPrivacyPolicy) && (
                <div className='login-page__agreement'>
                  <Checkbox
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                  >
                    <Text size='small' className='login-page__agreement-text'>
                      {t('我已阅读并同意')}
                      {hasUserAgreement && (
                        <a
                          href='/user-agreement'
                          target='_blank'
                          rel='noopener noreferrer'
                          className='login-page__agreement-link'
                        >
                          {t('用户协议')}
                        </a>
                      )}
                      {hasUserAgreement && hasPrivacyPolicy && t('和')}
                      {hasPrivacyPolicy && (
                        <a
                          href='/privacy-policy'
                          target='_blank'
                          rel='noopener noreferrer'
                          className='login-page__agreement-link'
                        >
                          {t('隐私政策')}
                        </a>
                      )}
                    </Text>
                  </Checkbox>
                </div>
              )}

              <div className='login-page__actions'>
                <Button
                  theme='solid'
                  type='primary'
                  htmlType='submit'
                  className='login-page__submit'
                  onClick={handleSubmit}
                  loading={loginLoading}
                  disabled={
                    (hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms
                  }
                >
                  {t('继续')}
                </Button>

                <Button
                  theme='borderless'
                  type='tertiary'
                  className='login-page__text-button'
                  onClick={handleResetPasswordClick}
                  loading={resetPasswordLoading}
                >
                  {t('忘记密码？')}
                </Button>
              </div>
            </Form>

            {!status.self_use_mode_enabled && (
              <div className='login-page__register'>
                <Text className='login-page__register-text'>
                  {t('没有账户？')}{' '}
                  <Link to='/register' className='login-page__register-link'>
                    {t('注册')}
                  </Link>
                </Text>
              </div>
            )}
          </div>
        </div>

        {turnstileEnabled && (
          <div className='login-page__turnstile'>
            <Turnstile
              sitekey={turnstileSiteKey}
              onVerify={(token) => {
                setTurnstileToken(token);
              }}
            />
          </div>
        )}
      </div>

      <Modal
        title={
          <div className='flex items-center'>
            <div className='w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mr-3'>
              <svg
                className='w-4 h-4 text-green-600 dark:text-green-400'
                fill='currentColor'
                viewBox='0 0 20 20'
              >
                <path
                  fillRule='evenodd'
                  d='M6 8a2 2 0 11-4 0 2 2 0 014 0zM8 7a1 1 0 100 2h8a1 1 0 100-2H8zM6 14a2 2 0 11-4 0 2 2 0 014 0zM8 13a1 1 0 100 2h8a1 1 0 100-2H8z'
                  clipRule='evenodd'
                />
              </svg>
            </div>
            两步验证
          </div>
        }
        visible={showTwoFA}
        onCancel={handleBackToLogin}
        footer={null}
        width={450}
        centered
      >
        <TwoFAVerification
          onSuccess={handle2FASuccess}
          onBack={handleBackToLogin}
          isModal={true}
        />
      </Modal>
    </div>
  );
};

export default LoginForm;
