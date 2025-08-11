// Welcome page functionality
function closeWelcome() {
  window.close();
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Add event listener to the get-started button
  const getStartedButton = document.querySelector('.get-started');
  if (getStartedButton) {
    getStartedButton.addEventListener('click', closeWelcome);
  }
});