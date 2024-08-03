const config = {
    licenyKey: "====BEGIN LICENSE KEY====\ngjGuT/adKJLR+fNSn44mHRJHun1fqKoeITCTXc+gbC12m1sNWD2qp2LYDrYQlPD3VegSfY61/BTZ+cVgizj5wJXIxbqPyIJAyWjyxN8zJ4i1q2bDBDHCqpSa/QUqTzlr3Zeq0+H5KtGiXbGej2TdQrlqBW4Cp3k05rez3UwFohmB6/EkfOm2itbqukxaQXoiIWXNAoUsfP95khYtrv79Jx5//Faw6f2jfZlbncZnRcxmJQbLQCqREEChUxsy8tK8EsI69w2vJMOE+jjYrpL33GtdN+eznC0AJ/w76G4IUKFWkqMyOGOLXTcu743zB+couc9LBEL+86XmiDPwUk6sfA==||U2FsdGVkX1+gyu4kfd1GotGWwnIMK5xF7YPIbpRxDy7jWEyflEZRmDXcLAqDViXG7qhMrwgzQW4gmrhpZ2MXNdab3dhQNgSW2ebrfKEVN50=\nlUUigbRDpTvVX5kfAILLVLVk9Wpz2xClgFrRYAvHAXJvrXksYP0C/GeEc7kPyapeI7e3lu77Oy6Fw05KaK++QF0V0PtxesGwHaWZ/UozpB8Dhu1EyvkGFmj4m8tSa/ch1AeCjldN00kmRX6g7GfsvoHQCJUDzeAS1WVH48bqW1nG+Jzav6uZmuahgmuaxY4WSiFprrlQWwGorNFw8GP3zNHvO//FDLiEXkg0IyZEOp9Mv4f8h8msNdNwLAN74i9b7G688h70esS5xyGGOwbkvMEnyKV4F/LWJVRT3gKHI7cCba+iwmLhC/TASs/z9B634yy9leODOB2yMhVxxk07pw==\n====END LICENSE KEY===="
}

function goToMainUrl() {
    window.location.href = "/"
}

window.addEventListener('load', function () {
    setTimeout(function () {
        document.querySelectorAll('img').forEach(function (img) {
            img.onerror = function () {
                this.classList.add('hidden');
            };
            if (!img.complete || img.naturalWidth === 0) {
                img.onerror();
            }
        });
    }, 1000); // 1000 milliseconds = 1 second
});