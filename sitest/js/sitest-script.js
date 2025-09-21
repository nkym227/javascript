// SiTest用JavaScript - 既存サイトに影響しないスコープ制限

(function () {
  'use strict';

  // SiTestブロック内のみで動作するように制限
  const SITEST_SCOPE = '.Sitest-block';

  // DOMが読み込まれた後に実行
  function initSiTestFeatures() {
    const sitestBlocks = document.querySelectorAll(SITEST_SCOPE);

    if (sitestBlocks.length === 0) {
      console.log('SiTest: No Sitest-block elements found');
      return;
    }

    console.log(`SiTest: Initializing features for ${sitestBlocks.length} block(s)`);

    sitestBlocks.forEach(block => {
      initBlockFeatures(block);
    });
  }

  // 各SiTestブロックの機能を初期化
  function initBlockFeatures(block) {
    // 1. スムーズスクロール
    initSmoothScroll(block);

    // 2. CTAボタンクリック追跡
    initCTATracking(block);

    // 3. フェードインアニメーション
    initFadeInAnimation(block);

    // 4. カウントダウンタイマー
    initCountdownTimer(block);

    // 5. フォーム送信処理
    initFormHandling(block);
  }

  // スムーズスクロール機能
  function initSmoothScroll(block) {
    const scrollLinks = block.querySelectorAll('a[href^="#"]');

    scrollLinks.forEach(link => {
      link.addEventListener('click', function (e) {
        e.preventDefault();

        const targetId = this.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });

          // アナリティクス送信
          trackEvent('scroll', 'smooth_scroll', targetId);
        }
      });
    });
  }

  // CTAボタンクリック追跡
  function initCTATracking(block) {
    const ctaButtons = block.querySelectorAll('.cta-button');

    ctaButtons.forEach((button, index) => {
      button.addEventListener('click', function (e) {
        const buttonText = this.textContent.trim();
        const buttonPosition = index + 1;

        // アナリティクス送信
        trackEvent('click', 'cta_button', buttonText, buttonPosition);

        // 視覚的フィードバック
        this.style.transform = 'scale(0.95)';
        setTimeout(() => {
          this.style.transform = '';
        }, 150);

        console.log(`SiTest: CTA clicked - "${buttonText}" (position: ${buttonPosition})`);
      });
    });
  }

  // フェードインアニメーション
  function initFadeInAnimation(block) {
    const animationElements = block.querySelectorAll('.fade-in-up');

    if (animationElements.length === 0) return;

    // Intersection Observer を使用してビューポートに入ったときにアニメーション
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.animation = 'fadeInUp 0.6s ease';
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1
    });

    animationElements.forEach(element => {
      element.style.opacity = '0';
      observer.observe(element);
    });
  }

  // カウントダウンタイマー
  function initCountdownTimer(block) {
    const countdownElements = block.querySelectorAll('.countdown-timer');

    countdownElements.forEach(element => {
      const endTime = element.dataset.endTime;
      if (!endTime) return;

      const targetDate = new Date(endTime).getTime();

      const timer = setInterval(() => {
        const now = new Date().getTime();
        const distance = targetDate - now;

        if (distance < 0) {
          clearInterval(timer);
          element.innerHTML = '<span style="color: #e74c3c; font-weight: bold;">期間終了</span>';
          return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        element.innerHTML = `
          <div style="display: flex; gap: 10px; justify-content: center; font-weight: bold;">
            <div><span style="color: #e74c3c;">${days}</span>日</div>
            <div><span style="color: #e74c3c;">${hours}</span>時間</div>
            <div><span style="color: #e74c3c;">${minutes}</span>分</div>
            <div><span style="color: #e74c3c;">${seconds}</span>秒</div>
          </div>
        `;
      }, 1000);
    });
  }

  // フォーム送信処理
  function initFormHandling(block) {
    const forms = block.querySelectorAll('form');

    forms.forEach(form => {
      form.addEventListener('submit', function (e) {
        e.preventDefault();

        const formData = new FormData(this);
        const formType = this.dataset.type || 'contact';

        // バリデーション
        if (!validateForm(this)) {
          return;
        }

        // 送信ボタンを無効化
        const submitButton = this.querySelector('button[type="submit"]');
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = '送信中...';
        }

        // アナリティクス送信
        trackEvent('form', 'submit', formType);

        // 実際のフォーム送信処理をここに実装
        setTimeout(() => {
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = '送信完了';
            submitButton.style.background = '#27ae60';
          }

          // 成功メッセージ表示
          showSuccessMessage(this);

          console.log(`SiTest: Form submitted - ${formType}`);
        }, 2000);
      });
    });
  }

  // フォームバリデーション
  function validateForm(form) {
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;

    requiredFields.forEach(field => {
      if (!field.value.trim()) {
        field.style.borderColor = '#e74c3c';
        isValid = false;
      } else {
        field.style.borderColor = '';
      }
    });

    return isValid;
  }

  // 成功メッセージ表示
  function showSuccessMessage(form) {
    const message = document.createElement('div');
    message.style.cssText = `
      background: #d4edda;
      color: #155724;
      padding: 15px;
      border-radius: 5px;
      margin-top: 10px;
      border: 1px solid #c3e6cb;
      text-align: center;
      font-weight: bold;
    `;
    message.textContent = 'お問い合わせありがとうございます。確認後、ご連絡いたします。';

    form.appendChild(message);

    setTimeout(() => {
      message.remove();
    }, 5000);
  }

  // アナリティクス送信（Google Analytics、GTM等）
  function trackEvent(action, category, label, value) {
    // Google Analytics 4
    if (typeof gtag !== 'undefined') {
      gtag('event', action, {
        event_category: category,
        event_label: label,
        value: value
      });
    }

    // Google Tag Manager
    if (typeof dataLayer !== 'undefined') {
      dataLayer.push({
        event: 'sitest_interaction',
        event_action: action,
        event_category: category,
        event_label: label,
        event_value: value
      });
    }

    // Facebook Pixel
    if (typeof fbq !== 'undefined') {
      fbq('track', 'CustomEvent', {
        action: action,
        category: category,
        label: label
      });
    }

    console.log(`SiTest Analytics: ${action} - ${category} - ${label}`, value);
  }

  // 初期化実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSiTestFeatures);
  } else {
    initSiTestFeatures();
  }

  // SiTest用のグローバル関数を提供
  window.SiTestUtils = {
    trackEvent: trackEvent,
    reinitialize: initSiTestFeatures
  };

})();