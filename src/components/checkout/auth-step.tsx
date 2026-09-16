'use client';

import { useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearAccount } from '@/components/site/account';
import { Alert, Spinner, cx } from '@/components/ui/primitives';
import { buttonClasses } from '@/components/ui/button-styles';
import { EyeIcon, EyeOffIcon } from '@/components/site/icons';
import { CheckoutField, describedBy } from './checkout-field';
import { useChoiceFlip } from './choice-flip';
import { shake } from './checkout-gsap';

/**
 * The Supabase browser client, fetched when it is about to be needed rather
 * than with the page. Focusing any field in the form starts the download, so by
 * the time somebody has typed an email and a password it has long since
 * arrived -- and `import()` is cached, so the focus and the submit share one
 * request. A visitor who reads the page and leaves never downloads it at all.
 */
const loadClient = () => import('@/lib/supabase/client');

type Mode = 'create' | 'signin';

const MIN_PASSWORD = 8;

function emailProblem(value: string): string | null {
  const email = value.trim();
  if (!email) return 'Enter your email address.';
  if (!email.includes('@')) return 'An email address needs an @, like name@example.com.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return 'That email address looks incomplete. Check the part after the @.';
  }
  return null;
}

function passwordProblem(value: string, mode: Mode): string | null {
  if (!value) return 'Enter a password.';
  if (mode === 'create' && value.length < MIN_PASSWORD) {
    return `Use at least ${MIN_PASSWORD} characters. This has ${value.length}.`;
  }
  return null;
}

function nameProblem(value: string): string | null {
  return value.trim().length >= 2 ? null : 'Enter your name as you would like us to use it.';
}

/**
 * Supabase's messages, turned into something to do. The one that matters most
 * is an existing account on a create attempt: that becomes an offer to sign in
 * with the email already filled, not a dead end.
 *
 * Signing in still refuses to say whether the email or the password was wrong
 * -- that difference tells a stranger which emails have accounts.
 */
function authProblem(mode: Mode, raw: string): { text: string; switchTo?: Mode } {
  const message = raw.toLowerCase();

  if (message.includes('rate limit') || message.includes('too many')) {
    return { text: 'Too many attempts in a row. Wait a minute, then try again.' };
  }
  if (message.includes('not confirmed')) {
    return { text: 'Confirm your email first: open the link we sent you, then sign in here.' };
  }
  if (mode === 'signin') {
    return { text: 'That email and password combination did not work.' };
  }
  if (message.includes('already') && message.includes('registered')) {
    return {
      text: 'There is already an account with this email. Sign in to it instead.',
      switchTo: 'signin',
    };
  }
  if (message.includes('password')) {
    return { text: `Choose a longer password: at least ${MIN_PASSWORD} characters.` };
  }
  return { text: raw };
}

/**
 * The account section of checkout.
 *
 * A plan needs an account -- it is where deliveries are skipped, paused and
 * tracked -- so there is no guest path, and the section says why instead of
 * leaving that to be resented. It is kept as short as the requirement allows:
 * name, email and a password for someone new; email and password for someone
 * returning. The mobile number and the address are asked for once, in the next
 * section, where they are obviously needed.
 *
 * Fields check themselves when they are left, not while they are being typed
 * into, and an error clears on the keystroke that fixes it. The password can be
 * shown, which on a phone keyboard is worth more than a confirmation field.
 */
export function CheckoutAuthStep() {
  const router = useRouter();
  const id = useId();
  const [mode, setMode] = useState<Mode>('create');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [problem, setProblem] = useState<{ text: string; switchTo?: Mode } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const switchRef = useRef<HTMLDivElement>(null);
  const captureRing = useChoiceFlip(switchRef, mode);

  const errors = {
    fullName: touched.fullName && mode === 'create' ? nameProblem(fullName) : null,
    email: touched.email ? emailProblem(email) : null,
    password: touched.password ? passwordProblem(password, mode) : null,
  };

  function choose(next: Mode) {
    if (next === mode) return;
    captureRing();
    setMode(next);
    setProblem(null);
    setNotice(null);
    setTouched({});
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const found = {
      fullName: mode === 'create' ? nameProblem(fullName) : null,
      email: emailProblem(email),
      password: passwordProblem(password, mode),
    };

    if (found.fullName || found.email || found.password) {
      setTouched({ fullName: true, email: true, password: true });
      const first = (['fullName', 'email', 'password'] as const).find((key) => found[key]);
      const control = formRef.current?.querySelector<HTMLElement>(`#${CSS.escape(`${id}-${first}`)}`);
      control?.focus();
      shake(control?.closest('.co-field'));
      return;
    }

    setPending(true);
    setProblem(null);
    setNotice(null);

    const { browserClient } = await loadClient();
    const supabase = browserClient();

    if (mode === 'create') {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      });

      if (error) {
        setProblem(authProblem(mode, error.message));
        setPending(false);
        shake(formRef.current?.querySelector('[type="submit"]'));
        return;
      }

      // With email confirmation switched on there is no session yet. Saying so
      // is better than leaving the customer on a section that will not advance.
      if (!data.session) {
        setNotice(
          'Check your email and open the link we sent, then come back here to finish. ' +
            'Your plan is saved on this device for two hours.',
        );
        setPending(false);
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setProblem(authProblem(mode, error.message));
        setPending(false);
        shake(formRef.current?.querySelector('[type="submit"]'));
        return;
      }
    }

    // The storefront header memoises "signed out" for the life of the page.
    clearAccount();
    router.refresh();
  }

  const fieldId = (name: string) => `${id}-${name}`;
  const passwordHint = mode === 'create' ? `At least ${MIN_PASSWORD} characters.` : undefined;

  return (
    <div className="co-auth">
      <p className="co-lede">
        Your plan lives in an account: it is where you skip, pause and track deliveries.
      </p>

      <div ref={switchRef} className="co-switch" role="group" aria-label="Do you have an account?">
        {(['create', 'signin'] as const).map((option) => (
          <button
            key={option}
            type="button"
            className="co-switch-option"
            aria-pressed={mode === option}
            onClick={() => choose(option)}
          >
            {mode === option ? <span className="choice-ring" data-flip-id="auth-mode" /> : null}
            <span className="relative">{option === 'create' ? 'I am new here' : 'I have an account'}</span>
          </button>
        ))}
      </div>

      <form
        ref={formRef}
        noValidate
        onSubmit={submit}
        onFocus={() => void loadClient()}
        className="co-form"
      >
        {problem ? (
          <div role="alert" className="co-form-alert">
            <Alert tone="danger">
              {problem.text}
              {problem.switchTo ? (
                <>
                  {' '}
                  <button
                    type="button"
                    className="co-inline-link"
                    onClick={() => choose(problem.switchTo!)}
                  >
                    Sign in with {email.trim()}
                  </button>
                </>
              ) : null}
            </Alert>
          </div>
        ) : null}

        {notice ? (
          <div role="status">
            <Alert tone="info">{notice}</Alert>
          </div>
        ) : null}

        {mode === 'create' ? (
          <CheckoutField
            id={fieldId('fullName')}
            label="Full name"
            required
            error={errors.fullName}
            valid={touched.fullName && !nameProblem(fullName)}
          >
            <input
              id={fieldId('fullName')}
              className="co-input"
              value={fullName}
              required
              autoComplete="name"
              autoCapitalize="words"
              enterKeyHint="next"
              aria-invalid={errors.fullName ? true : undefined}
              aria-describedby={describedBy(fieldId('fullName'), errors.fullName)}
              onChange={(event) => setFullName(event.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, fullName: true }))}
            />
          </CheckoutField>
        ) : null}

        <CheckoutField
          id={fieldId('email')}
          label="Email"
          required
          error={errors.email}
          valid={touched.email && !emailProblem(email)}
        >
          <input
            id={fieldId('email')}
            className="co-input"
            type="email"
            inputMode="email"
            value={email}
            required
            autoComplete={mode === 'create' ? 'email' : 'username'}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describedBy(fieldId('email'), errors.email)}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: email.trim() ? true : t.email }))}
          />
        </CheckoutField>

        <CheckoutField
          id={fieldId('password')}
          label="Password"
          required
          hint={passwordHint}
          error={errors.password}
        >
          <input
            id={fieldId('password')}
            className="co-input co-input-with-action"
            type={showPassword ? 'text' : 'password'}
            value={password}
            required
            minLength={mode === 'create' ? MIN_PASSWORD : undefined}
            autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={describedBy(fieldId('password'), errors.password, passwordHint)}
            onChange={(event) => setPassword(event.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, password: password ? true : t.password }))}
          />
          <button
            type="button"
            className="co-input-action"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((shown) => !shown)}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </CheckoutField>

        <button
          type="submit"
          className={cx(buttonClasses('primary', 'lg'), 'btn-square co-submit')}
          disabled={pending}
        >
          {pending ? <Spinner /> : null}
          {mode === 'create' ? 'Create account and continue' : 'Sign in and continue'}
        </button>
      </form>
    </div>
  );
}
