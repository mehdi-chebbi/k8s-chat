module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'k8s-blue': '#326CE5',
        'k8s-dark': '#1A202C',
        'k8s-darker': '#0F1419',
        'k8s-light': '#F0F8FF',
        'k8s-cyan': '#00D4AA',
        'k8s-orange': '#FF6B00',
        'k8s-yellow': '#FDB813',
        'k8s-green': '#00A94F',
        'k8s-purple': '#6B46C1',
        'k8s-gray': '#555555',
        'k8s-light-gray': '#E5E5E5'
      },
      backgroundImage: {
        'k8s-gradient': 'linear-gradient(135deg, #1A202C 0%, #2D3748 50%, #1A202C 100%)',
        'k8s-card': 'linear-gradient(135deg, rgba(50, 108, 229, 0.1) 0%, rgba(0, 212, 170, 0.1) 100%)',
        'k8s-hover': 'linear-gradient(135deg, rgba(50, 108, 229, 0.2) 0%, rgba(0, 212, 170, 0.2) 100%)'
      },
      animation: {
        'k8s-pulse': 'k8s-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'k8s-spin': 'k8s-spin 1s linear infinite',
        'k8s-bounce': 'k8s-bounce 1s infinite',
      },
      keyframes: {
        'k8s-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.5' }
        },
        'k8s-spin': {
          'from': { transform: 'rotate(0deg)' },
          'to': { transform: 'rotate(360deg)' }
        },
        'k8s-bounce': {
          '0%, 100%': { transform: 'translateY(-5%)' },
          '50%': { transform: 'translateY(0)' }
        }
      }
    },
  },
  plugins: [],
}