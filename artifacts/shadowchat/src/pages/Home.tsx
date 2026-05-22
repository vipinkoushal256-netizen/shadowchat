import React, { useState, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { MessageSquare, Users, Shield, Zap, Sparkles, ChevronRight, Play } from "lucide-react";
import { useLocation } from "wouter";

const profiles = [
  {
    name: "MidnightSoul",
    status: "Online",
    points: "12.4k",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=800&auto=format&fit=crop"
  },
  {
    name: "VelvetGhost",
    status: "Typing...",
    points: "9.1k",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=800&auto=format&fit=crop"
  },
  {
    name: "NeonEyes",
    status: "Online",
    points: "17.8k",
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=800&auto=format&fit=crop"
  }
];

export default function Home() {
  const [, setLocation] = useLocation();
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, 100]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden selection:bg-primary/30">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background opacity-60" />
      </div>

      <div className="relative z-10">
        {/* Nav */}
        <motion.nav 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-between px-6 md:px-12 py-6 border-b border-white/5 backdrop-blur-md sticky top-0 z-50"
        >
          <h1 className="text-2xl font-bold tracking-[0.2em]">
            SHADOW<span className="text-primary">CHAT</span>
          </h1>

          <button
            onClick={() => setLocation("/chat")}
            data-testid="button-join-now"
            className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:scale-105 transition-transform duration-300"
          >
            Join Now
          </button>
        </motion.nav>

        {/* Hero */}
        <section className="max-w-7xl mx-auto px-6 md:px-12 pt-24 pb-32 grid lg:grid-cols-2 gap-16 items-center min-h-[90vh]">
          <motion.div style={{ opacity: heroOpacity, y: heroY }}>
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-medium uppercase tracking-wider mb-8"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Anonymous Interactive Platform
            </motion.div>

            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-6xl md:text-8xl font-black leading-[1.1] tracking-tighter"
            >
              Enter The
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-400">
                Private Side
              </span>
            </motion.h2>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="mt-8 text-muted-foreground text-xl md:text-2xl leading-relaxed max-w-xl font-light"
            >
              Chat anonymously. Earn points. Share moments. Unlock rewards.
              A luxury real-time experience designed for deep interactions.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="flex flex-wrap gap-5 mt-12"
            >
              <button
                onClick={() => setLocation("/chat")}
                data-testid="button-start-chatting"
                className="group relative px-8 py-4 rounded-full bg-primary text-primary-foreground font-bold text-lg overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Start Chatting <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              </button>

              <button
                onClick={() => setLocation("/chat")}
                data-testid="button-explore-profiles"
                className="px-8 py-4 rounded-full border border-white/10 hover:bg-white/5 font-semibold text-lg transition-colors duration-300"
              >
                Explore Profiles
              </button>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 1 }}
              className="grid grid-cols-3 gap-6 mt-16 pt-16 border-t border-white/5"
            >
              <div>
                <div className="text-4xl font-bold tracking-tight text-white">12k+</div>
                <div className="text-muted-foreground mt-2 text-sm uppercase tracking-wider font-medium">Daily Chats</div>
              </div>
              <div>
                <div className="text-4xl font-bold tracking-tight text-white">98%</div>
                <div className="text-muted-foreground mt-2 text-sm uppercase tracking-wider font-medium">Anonymous</div>
              </div>
              <div>
                <div className="text-4xl font-bold tracking-tight text-white">24/7</div>
                <div className="text-muted-foreground mt-2 text-sm uppercase tracking-wider font-medium">Live Replies</div>
              </div>
            </motion.div>
          </motion.div>

          {/* Cards Column */}
          <div className="relative lg:h-[600px] flex items-center justify-center">
            <div className="absolute inset-0 bg-primary/10 blur-[100px] rounded-full" />

            <motion.div 
              initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ delay: 0.4, duration: 0.8, type: "spring" }}
              className="relative w-full max-w-md bg-card/40 border border-white/10 rounded-[40px] p-8 backdrop-blur-2xl shadow-2xl"
            >
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-xl font-bold tracking-wide">Trending Profiles</h3>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-primary text-sm font-bold tracking-wider">LIVE</span>
                </div>
              </div>

              <div className="space-y-4">
                {profiles.map((profile, index) => (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                    key={index}
                    className="group flex items-center justify-between bg-black/40 border border-white/5 rounded-3xl p-4 hover:border-primary/40 transition-all duration-300 cursor-pointer hover:bg-black/60"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <img
                          src={profile.image}
                          alt={profile.name}
                          className="w-14 h-14 rounded-2xl object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
                        />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-black bg-green-500" />
                      </div>

                      <div>
                        <div className="font-bold text-base text-white/90 group-hover:text-white transition-colors">{profile.name}</div>
                        <div className="text-muted-foreground text-xs font-medium mt-0.5">{profile.status}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-primary font-black text-lg">{profile.points}</div>
                      <div className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold">pts</div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="mt-8 relative overflow-hidden rounded-3xl p-6 border border-white/10 group cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-orange-500 opacity-90 group-hover:opacity-100 transition-opacity" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-2xl transform translate-x-10 -translate-y-10 group-hover:translate-x-5 transition-transform" />
                
                <div className="relative z-10 text-primary-foreground">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black uppercase tracking-widest opacity-80">Bonus System</div>
                    <Sparkles className="w-5 h-5 opacity-80" />
                  </div>
                  <div className="text-2xl font-black mt-3 leading-tight">Earn More Points</div>
                  <p className="mt-2 text-primary-foreground/80 text-sm font-medium">
                    Longer conversations & media interactions multiply your rewards.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-32 border-t border-white/5 relative bg-black/20">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6">Engineered for Privacy</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-light">
                Every feature is built to protect your identity while maximizing engagement.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: MessageSquare,
                  title: "Real-Time Chat",
                  desc: "Smooth messaging system with instant replies and premium, distraction-free UI."
                },
                {
                  icon: Play,
                  title: "Media Sharing",
                  desc: "Send images, audio and short-form videos securely directly inside chats."
                },
                {
                  icon: Zap,
                  title: "Reward System",
                  desc: "Earn points, build streaks and unlock engagement rewards for active participation."
                }
              ].map((feat, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ delay: i * 0.2, duration: 0.6 }}
                  key={i}
                  className="bg-card/30 border border-white/5 hover:border-primary/30 rounded-[30px] p-10 backdrop-blur-md transition-all duration-300 hover:-translate-y-2 group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300">
                    <feat.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4 tracking-tight">{feat.title}</h3>
                  <p className="text-muted-foreground leading-relaxed font-light text-lg">
                    {feat.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Deep Dive Section */}
        <section className="py-32 overflow-hidden relative">
          <div className="max-w-7xl mx-auto px-6 md:px-12 grid lg:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-4xl md:text-6xl font-black mb-8 leading-tight tracking-tighter">
                Anonymity <br/>
                <span className="text-muted-foreground">Is A Luxury.</span>
              </h2>
              <p className="text-xl text-muted-foreground font-light leading-relaxed mb-10">
                In a world of constant surveillance, the ultimate status symbol is being unknown. ShadowChat provides a secure enclave where your ideas, connections, and interactions define you—not your real-world identity.
              </p>
              
              <ul className="space-y-6">
                {[
                  "Zero-knowledge architecture",
                  "End-to-end encrypted direct messaging",
                  "Disappearing media attachments",
                  "Blockchain-verified point ledgers"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-4 text-lg font-medium">
                    <Shield className="w-6 h-6 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative aspect-square md:aspect-video rounded-[40px] overflow-hidden border border-white/10"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-black via-transparent to-black/50 z-10" />
              <img 
                src="https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1200&auto=format&fit=crop" 
                alt="Abstract dark luxury texture"
                className="w-full h-full object-cover grayscale opacity-60"
              />
              <div className="absolute inset-0 z-20 flex items-center justify-center">
                <div className="w-32 h-32 rounded-full border border-primary/30 flex items-center justify-center backdrop-blur-sm bg-black/20">
                  <Shield className="w-12 h-12 text-primary" />
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 relative border-t border-white/5">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5 pointer-events-none" />
          <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-5xl md:text-7xl font-black mb-8 tracking-tighter"
            >
              Ready To <span className="text-primary">Disappear?</span>
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-2xl text-muted-foreground font-light mb-12"
            >
              Join the elite underground network. Claim your alias.
            </motion.p>
            <motion.button 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              onClick={() => setLocation("/chat")}
              data-testid="button-create-account"
              className="px-12 py-5 rounded-full bg-primary text-primary-foreground font-black text-xl hover:scale-105 transition-transform duration-300 shadow-[0_0_40px_rgba(250,204,21,0.3)] hover:shadow-[0_0_60px_rgba(250,204,21,0.5)]"
            >
              Create Account
            </motion.button>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 py-12 text-center text-muted-foreground text-sm font-medium">
          <div className="flex items-center justify-center gap-8 mb-6">
            <a href="#" className="hover:text-primary transition-colors">Terms</a>
            <a href="#" className="hover:text-primary transition-colors">Privacy</a>
            <a href="#" className="hover:text-primary transition-colors">Guidelines</a>
          </div>
          <p>© {new Date().getFullYear()} ShadowChat. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
