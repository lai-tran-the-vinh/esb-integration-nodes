// tailwind.config.js
const pxSpacing = {};
for (let i = 0; i <= 1000; i++) {
  pxSpacing[i] = `${i}px`;
}

module.exports = {
  content: ["./views/**/*.ejs"],
  theme: {
    extend: {
      spacing: pxSpacing,
    },
  },
  plugins: [],
};