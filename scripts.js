document.addEventListener('DOMContentLoaded', function() {
    const blogList = document.getElementById('blog-list');
    fetch('data/posts.json')
    .then(response => response.json())
    .then(posts => {
        posts.forEach(post => {
            const postElement = document.createElement('div');
            postElement.classList.add('blog-post');
            postElement.innerHTML = `
                <h2>${post.title}</h2>
                <p class="blog-date">${post.date}</p>
                <p>${post.content}</p>
            `;
            blogList.appendChild(postElement);
        });
    })
    .catch(error => console.error('Error loading blog posts:', error));
});
