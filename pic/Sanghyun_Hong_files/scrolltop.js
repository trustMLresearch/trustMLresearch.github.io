/*
 *  onscroll function callback:
 *    When a user scrolls down 20px from the top of the doc, show the button.
 */
window.onscroll = function() {scrollFunction()};
function scrollFunction() {
  if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
    document.getElementById("topBtn").style.display = "block";
  } else {
    document.getElementById("topBtn").style.display = "none";
  }
}

/*
 *  onscroll function callback:
 *    When a user clicks on the button, scroll to the top of the document
 */
function topFunction() {
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
}
