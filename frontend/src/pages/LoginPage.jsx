import { useState, useEffect, useRef } from "react";
import { BriefcaseMedicalIcon } from "lucide-react";
import { Link } from "react-router";
import toast from "react-hot-toast";
import useLogin from "../hooks/useLogin";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LoginPage = () => {
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const { isPending, loginMutation } = useLogin();
  const emailRef = useRef(null);

  const images = ["/i_0.png", "/i_1.png", "/i_2.png"];
  const texts = [
    "Start your journey to better health with expert care.",
    "Get advice from top medical professionals.",
    "Your trusted partner for reliable medical guidance.",
  ];
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!EMAIL_REGEX.test(loginData.email)) {
      emailRef.current?.setCustomValidity("Please enter a valid email address (e.g. name@example.com)");
      emailRef.current?.reportValidity();
      return;
    }
    loginMutation(loginData, {
      onError: (err) => toast.error(err?.response?.data?.message || "Invalid email or password."),
    });
  };

  return (
    <div className="h-screen flex items-center justify-center p-4 sm:p-6 md:p-8" data-theme="light">
      <div className="border border-primary/25 flex flex-col lg:flex-row w-full max-w-5xl mx-auto bg-base-100 rounded-xl shadow-lg overflow-hidden">

        {/* LOGIN FORM SECTION */}
        <div className="w-full lg:w-1/2 p-4 sm:p-8 flex flex-col">
          <div className="mb-4 flex items-center justify-start gap-2">
            <BriefcaseMedicalIcon className="size-9 text-primary" />
            <span className="text-accent text-3xl font-bold font-mono tracking-wider">MedConnect</span>
          </div>

          <div className="w-full">
            <form onSubmit={handleLogin}>
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">Welcome Back</h2>
                  <p className="text-sm opacity-70">
                    Sign in to your account to continue your journey to better health
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="form-control w-full">
                    <label className="label"><span className="label-text">Email</span></label>
                    <input
                      ref={emailRef}
                      type="email"
                      placeholder="JohnDoe@example.com"
                      className="input input-bordered w-full"
                      value={loginData.email}
                      required
                      onChange={(e) => {
                        setLoginData({ ...loginData, email: e.target.value });
                        e.target.setCustomValidity("");
                      }}
                      onBlur={(e) => {
                        if (!e.target.value) e.target.setCustomValidity("Email is required");
                        else if (!EMAIL_REGEX.test(e.target.value)) e.target.setCustomValidity("Please enter a valid email address (e.g. name@example.com)");
                        else e.target.setCustomValidity("");
                      }}
                    />
                  </div>

                  <div className="form-control w-full">
                    <label className="label"><span className="label-text">Password</span></label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="input input-bordered w-full"
                      value={loginData.password}
                      required
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary w-full" disabled={isPending}>
                    {isPending ? <><span className="loading loading-spinner loading-xs" />Signing in...</> : "Sign In"}
                  </button>

                  <div className="text-center mt-4">
                    <p className="text-sm">
                      Don't have an account?{" "}
                      <Link to="/signup" className="text-primary hover:underline">Create one</Link>
                    </p>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* IMAGE SECTION */}
        <div className="hidden lg:flex w-full lg:w-1/2 bg-primary/10 items-center justify-center">
          <div className="max-w-md p-8">
            <div className="relative aspect-square max-w-sm mx-auto">
              <img src={images[currentIndex]} alt="MedConnect illustration" className="w-full h-full" />
            </div>
            <div className="text-center space-y-3 mt-6">
              <h2 className="text-xl font-semibold">Connect with licensed professionals</h2>
              <p className="opacity-70">{texts[currentIndex]}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;