<template>
  <div class="container">
    <!-- Header (fixed position that scrolls with page) -->
    <header class="header">
      <div class="logo">
        <!-- Logo placeholder -->
      </div>
      <nav class="navigation">
        <!-- Navigation items -->
      </nav>
    </header>

    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-content">
        <h1><!-- Title placeholder --></h1>
        <p><!-- Subtitle placeholder --></p>
        <div class="cta-buttons">
          <!-- Call to action buttons -->
        </div>
      </div>
      <div class="social-links">
        <!-- Social media icons -->
      </div>
    </section>

    <!-- Features Section (dark background with circular elements) -->
    <section class="features-section">
      <div class="feature-intro">
        <!-- Centered text with circular background -->
      </div>
      <div class="feature-description">
        <!-- Second text with circular background -->
      </div>
    </section>

    <!-- Info Cards Section -->
    <section class="info-cards-section">
      <div class="info-card">
        <!-- First info box -->
      </div>
      <div class="info-card">
        <!-- Second info box -->
      </div>
    </section>

    <!-- Three Column Section -->
    <section class="three-column-section">
      <div class="column">
        <h3><!-- Column title 1 --></h3>
        <p><!-- Column content 1 --></p>
        <div class="circle-icon"><!-- Circle icon 1 --></div>
      </div>
      <div class="column">
        <h3><!-- Column title 2 --></h3>
        <p><!-- Column content 2 --></p>
        <div class="circle-icon"><!-- Circle icon 2 --></div>
      </div>
      <div class="column">
        <h3><!-- Column title 3 --></h3>
        <p><!-- Column content 3 --></p>
        <div class="circle-icon"><!-- Circle icon 3 --></div>
      </div>
    </section>

    <!-- Diagram Section -->
    <section class="diagram-section">
      <div class="concentric-circles">
        <!-- Concentric circles with labels around -->
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta-section">
      <h2><!-- CTA title --></h2>
      <div class="cta-buttons">
        <!-- Call to action buttons -->
      </div>
      <p><!-- Additional text --></p>
      <button class="main-cta"><!-- Main CTA button --></button>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-content">
        <!-- Copyright and links -->
      </div>
      <div class="footer-social">
        <!-- Social media links -->
      </div>
    </footer>
  </div>
</template>

<script>
export default {
	name: "IndexPage",
	data() {
		return {
			// Add reactive data if needed
		}
	},
	methods: {
		// Add methods if needed
	}
}
</script>

<style>
/* Reset and base styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: sans-serif;
  line-height: 1.6;
}

.container {
  width: 100%;
  overflow-x: hidden;
}

/* Header Styles */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  width: 100%;
  position: sticky;
  top: 0;
  z-index: 100;
}

/* Hero Section */
.hero-section {
  min-height: 80vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 2rem;
  position: relative;
}

.hero-content {
  max-width: 600px;
  margin-bottom: 2rem;
}

.cta-buttons {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

.social-links {
  position: absolute;
  bottom: 2rem;
  right: 2rem;
  display: flex;
  gap: 1rem;
}

/* Features Section */
.features-section {
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 4rem 2rem;
  text-align: center;
  position: relative;
}

.feature-intro, .feature-description {
  max-width: 500px;
  margin: 2rem 0;
  padding: 2rem;
  border-radius: 50%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Info Cards Section */
.info-cards-section {
  display: flex;
  flex-wrap: wrap;
  padding: 4rem 2rem;
  gap: 2rem;
  justify-content: center;
}

.info-card {
  flex: 1;
  min-width: 300px;
  max-width: 500px;
  padding: 2rem;
}

/* Three Column Section */
.three-column-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  padding: 4rem 2rem;
  text-align: center;
}

.column {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem;
}

.circle-icon {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  margin-top: 1.5rem;
}

/* Diagram Section */
.diagram-section {
  min-height: 60vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 4rem 2rem;
}

.concentric-circles {
  position: relative;
  width: 80%;
  max-width: 600px;
  aspect-ratio: 1;
}

/* CTA Section */
.cta-section {
  min-height: 50vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 4rem 2rem;
}

.main-cta {
  margin-top: 2rem;
  padding: 0.8rem 2rem;
  border: none;
  cursor: pointer;
}

/* Footer */
.footer {
  display: flex;
  justify-content: space-between;
  padding: 2rem;
  flex-wrap: wrap;
}

/* Responsive Adjustments */
@media (max-width: 768px) {
  .info-cards-section {
    flex-direction: column;
  }

  .three-column-section {
    grid-template-columns: 1fr;
  }

  .footer {
    flex-direction: column;
    gap: 1.5rem;
  }
}
</style>
