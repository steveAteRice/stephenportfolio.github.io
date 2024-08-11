document.addEventListener('DOMContentLoaded', function() {
    const blogList = document.getElementById('blog-list');
    
    fetch('data/posts.json')
    .then(response => response.json())
    .then(posts => {
        posts.forEach(post => {
            const postElement = document.createElement('div');
            postElement.classList.add('blog-post');
            
            // Create and append title
            const titleElement = document.createElement('h2');
            titleElement.innerHTML = post.title;
            postElement.appendChild(titleElement);
            
            // Create and append date
            const dateElement = document.createElement('p');
            dateElement.classList.add('date');
            dateElement.innerHTML = post.date;
            postElement.appendChild(dateElement);
            
            // Create and append content
            const contentElement = document.createElement('p');
            contentElement.classList.add('content');
            contentElement.innerHTML = post.content.replace(/\n/g, '<br>');
            postElement.appendChild(contentElement);
            
            blogList.appendChild(postElement);
        });
    })
    .catch(error => console.error('Error loading blog posts:', error));
});
