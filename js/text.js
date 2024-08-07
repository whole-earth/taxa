export function textTransitionInit() {

    if (document.querySelector('.child')) {

        const splash = document.querySelector('.splash');
        const zoom = document.querySelector('.zoom');
        const zoomOut = document.querySelector('.zoom-out');
        const product = document.querySelector('.product');

        const splashText = splash.querySelector('.child');
        const zoomChild__One = dive.querySelectorAll('.child')[0];
        const zoomChild__Two = dive.querySelectorAll('.child')[1];
        const zoomChild__Three = dive.querySelectorAll('.child')[2];
        const productText = human.querySelector('.product');

        let isScrolling = false;

        window.addEventListener('scroll', () => {

            checkAndToggleScrollTop();

            // toggle text visibilities
            if (!isScrolling) {
                window.requestAnimationFrame(() => {
                    handleElementVisibility(splash, splashChild);
                    handleElementVisibility(dive, diveChild);
                    handleElementVisibility(human, humanChild);
                    isScrolling = false;
                });
                isScrolling = true;
            }
        });

        function handleElementVisibility(parent, child) {
            if (isElementFullyVisible(parent)) {
                child.style.opacity = 1;
            } else {
                child.style.opacity = 0;
            }
        }

        function isElementFullyVisible(element) {
            const rect = element.getBoundingClientRect();
            const elementTopRelativeToDocument = rect.top + window.scrollY;
            const elementBottomRelativeToDocument = rect.bottom + window.scrollY;
            const viewportHeight = window.innerHeight;
            const scrollY = window.scrollY;

            return scrollY >= elementTopRelativeToDocument &&
                scrollY < elementBottomRelativeToDocument - viewportHeight;
        }

        function checkAndToggleScrollTop() {
            if (window.scrollY < 140) {
                splashChild.classList.add('scroll_top');
            } else if (window.scrollY >= 140) {
                splashChild.classList.remove('scroll_top');
            }
        }

        //==========

        // Check if .announcement element exists
        // Define variables outside the event listener function
        const announcementElement = document.querySelector('.announcement');
        const splashChildElement = document.querySelector('.splash-child');
        let announcementHeight;
        let announcementOffsetTop;

        // Check if .announcement element exists
        if (announcementElement && splashChildElement) {
            announcementHeight = announcementElement.offsetHeight;
            announcementOffsetTop = announcementElement.offsetTop;

            // Add window scroll event listener
            window.addEventListener('scroll', textOffsetAnnouncement);
        }

        function textOffsetAnnouncement() {
            const scrollTop = window.scrollY;
            let percentageScrolled;

            if (scrollTop <= announcementOffsetTop) {
                percentageScrolled = 0;
            } else if (scrollTop >= announcementOffsetTop + announcementHeight) {
                percentageScrolled = 1;
            } else {
                percentageScrolled = (scrollTop - announcementOffsetTop) / announcementHeight;
            }

            const topValue = (1 - percentageScrolled) * 8 + percentageScrolled * 5;

            splashChildElement.style.top = topValue + 'rem';
        }
    }
    else {
        console.log('Did not initialize text transitions: no .child elems')
    }
}