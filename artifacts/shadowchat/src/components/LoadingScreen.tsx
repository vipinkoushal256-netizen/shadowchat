import { motion } from "framer-motion";

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-black to-zinc-950" />

      <motion.div
        className="relative z-10 flex flex-col items-center gap-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.h1
          className="text-4xl font-black tracking-widest"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          SHADOW<span className="text-yellow-400">CHAT</span>
        </motion.h1>

        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-yellow-400/30"
            />
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-t-yellow-400 border-r-yellow-400/50 border-b-transparent border-l-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>

          <motion.p
            className="text-zinc-500 text-sm tracking-widest uppercase"
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            Entering the shadows...
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}
