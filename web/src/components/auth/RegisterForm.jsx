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
import { Link, useNavigate } from 'react-router-dom';
import {
  API,
  getLogo,
  showError,
  showInfo,
  showSuccess,
} from '../../helpers';
import Turnstile from 'react-turnstile';
import { Button, Checkbox, Form } from '@douyinfe/semi-ui';
import Text from '@douyinfe/semi-ui/lib/es/typography/text';
import {
  IconKey,
  IconLock,
  IconMail,
  IconUser,
} from '@douyinfe/semi-icons';
import { StatusContext } from '../../context/Status';
import { useTranslation } from 'react-i18next';

const RegisterForm = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [inputs, setInputs] = useState({
    username: '',
    password: '',
    password2: '',
    email: '',
    verification_code: '',
  });
  const { username, password, password2 } = inputs;
  const [statusState] = useContext(StatusContext);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [verificationCodeLoading, setVerificationCodeLoading] = useState(false);
  const [disableButton, setDisableButton] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [hasUserAgreement, setHasUserAgreement] = useState(false);
  const [hasPrivacyPolicy, setHasPrivacyPolicy] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);

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
    setShowEmailVerification(!!status?.email_verification);
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
    let countdownInterval = null;
    if (disableButton && countdown > 0) {
      countdownInterval = setInterval(() => {
        setCountdown((current) => current - 1);
      }, 1000);
    } else if (countdown === 0) {
      setDisableButton(false);
      setCountdown(30);
    }
    return () => clearInterval(countdownInterval);
  }, [disableButton, countdown]);

  function handleChange(name, value) {
    setInputs((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event?.preventDefault?.();

    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    if (password.length < 8) {
      showInfo('密码长度不得小于 8 位！');
      return;
    }
    if (password !== password2) {
      showInfo('两次输入的密码不一致');
      return;
    }
    if (!username || !password) {
      showError('请输入用户名和密码！');
      return;
    }
    if (showEmailVerification && !inputs.email) {
      showError('请输入邮箱地址！');
      return;
    }
    if (showEmailVerification && !inputs.verification_code) {
      showError('请输入邮箱验证码！');
      return;
    }
    if (turnstileEnabled && turnstileToken === '') {
      showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
      return;
    }

    setRegisterLoading(true);
    try {
      const res = await API.post(
        `/api/user/register?turnstile=${turnstileToken}`,
        inputs,
      );
      const { success, message } = res.data;
      if (success) {
        navigate('/login');
        showSuccess('注册成功！');
      } else {
        showError(message);
      }
    } catch (error) {
      showError('注册失败，请重试');
    } finally {
      setRegisterLoading(false);
    }
  }

  const sendVerificationCode = async () => {
    if (inputs.email === '') {
      showInfo('请输入邮箱地址！');
      return;
    }
    if (turnstileEnabled && turnstileToken === '') {
      showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
      return;
    }

    setVerificationCodeLoading(true);
    try {
      const res = await API.get(
        `/api/verification?email=${encodeURIComponent(inputs.email)}&turnstile=${turnstileToken}`,
      );
      const { success, message } = res.data;
      if (success) {
        showSuccess('验证码发送成功，请检查你的邮箱！');
        setDisableButton(true);
      } else {
        showError(message);
      }
    } catch (error) {
      showError('发送验证码失败，请重试');
    } finally {
      setVerificationCodeLoading(false);
    }
  };

  return (
    <div className='login-page'>
      <Link to='/' className='login-page__brand' aria-label='返回首页'>
        <img src={logo} alt='Logo' className='login-page__brand-image' />
      </Link>

      <div className='login-page__shell'>
        <div className='login-page__card'>
          <div className='login-page__content login-page__content--register'>
            <div className='login-page__header'>
              <h1 className='login-page__title'>{t('注册')}</h1>
            </div>

            <Form className='login-page__form'>
              <div className='login-page__field'>
                <Form.Input
                  field='username'
                  label={t('用户名')}
                  placeholder={t('请输入用户名')}
                  name='username'
                  value={inputs.username}
                  onChange={(value) => handleChange('username', value)}
                  prefix={<IconUser />}
                />
              </div>

              <div className='login-page__field'>
                <Form.Input
                  field='password'
                  label={t('密码')}
                  placeholder={t('输入密码，最短 8 位，最长 20 位')}
                  name='password'
                  mode='password'
                  value={inputs.password}
                  onChange={(value) => handleChange('password', value)}
                  prefix={<IconLock />}
                />
              </div>

              <div className='login-page__field'>
                <Form.Input
                  field='password2'
                  label={t('确认密码')}
                  placeholder={t('确认密码')}
                  name='password2'
                  mode='password'
                  value={inputs.password2}
                  onChange={(value) => handleChange('password2', value)}
                  prefix={<IconLock />}
                />
              </div>

              {showEmailVerification && (
                <>
                  <div className='login-page__field'>
                    <Form.Input
                      field='email'
                      label={t('邮箱')}
                      placeholder={t('输入邮箱地址')}
                      name='email'
                      type='email'
                      value={inputs.email}
                      onChange={(value) => handleChange('email', value)}
                      prefix={<IconMail />}
                      suffix={
                        <Button
                          className='login-page__inline-button'
                          onClick={sendVerificationCode}
                          loading={verificationCodeLoading}
                          disabled={disableButton || verificationCodeLoading}
                        >
                          {disableButton
                            ? `${t('重新发送')} (${countdown})`
                            : t('获取验证码')}
                        </Button>
                      }
                    />
                  </div>

                  <div className='login-page__field'>
                    <Form.Input
                      field='verification_code'
                      label={t('验证码')}
                      placeholder={t('输入验证码')}
                      name='verification_code'
                      value={inputs.verification_code}
                      onChange={(value) =>
                        handleChange('verification_code', value)
                      }
                      prefix={<IconKey />}
                    />
                  </div>
                </>
              )}

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
                  className='login-page__submit'
                  type='primary'
                  htmlType='submit'
                  onClick={handleSubmit}
                  loading={registerLoading}
                  disabled={
                    (hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms
                  }
                >
                  {t('注册')}
                </Button>
              </div>
            </Form>

            <div className='login-page__register'>
              <Text className='login-page__register-text'>
                {t('已有账户？')}{' '}
                <Link to='/login' className='login-page__register-link'>
                  {t('登录')}
                </Link>
              </Text>
            </div>
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
    </div>
  );
};

export default RegisterForm;
