/*
 *  Custom Javascript codes
 */


/*
 *  Active an item, when clicked (bootstrap 4)
 */
$(".nav a").on("click", function(){
    $(".nav").find(".active").removeClass("active");
    $(this).addClass("active");
});


/*
 *  Handle hashes when the page loads
 */
var shiftWindow = function() { scrollBy(0, -100) };
window.addEventListener("hashchange", shiftWindow);
function load() { if (window.location.hash) shiftWindow(); }

